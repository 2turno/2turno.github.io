// Servidor da apuracao (roda na VPS): baixa os boletins do TSE uma unica vez, em segundo plano,
// e entrega as somas prontas para todos os visitantes do site estatico.
import fs from "node:fs";
import http from "node:http";
import { apuracao, apuracaoComUrnas, baseDoEstado1T, definirCandidatos, municipio, municipiosUf, unidadeDoEstado, unidadesDoEstado, type Base } from "../src/lib/cliente";
import { UFS, velocidade } from "../src/lib/tse";
import { type Unidade } from "../src/lib/previsao";
import { fotografar, registrarFoto, type Foto } from "../src/lib/linhaTempo";

// base do 1o turno por municipio (nao muda mais): baixada uma vez e guardada em disco
const ARQ_BASE = process.env.ARQ_BASE ?? "base-1turno.json";
const base: Record<string, Base> = fs.existsSync(ARQ_BASE) ? JSON.parse(fs.readFileSync(ARQ_BASE, "utf8")) : {};
async function carregarBase() {
  for (const uf of UFS) {
    if (base[uf]) continue;
    const b = await baseDoEstado1T(uf).catch(() => null);
    if (b) {
      base[uf] = b;
      fs.writeFileSync(ARQ_BASE, JSON.stringify(base));
      console.log(`base do 1º turno: ${uf.toUpperCase()} pronta (${Object.keys(b).length} municípios)`);
    }
  }
  if (UFS.some((uf) => !base[uf])) setTimeout(carregarBase, 30_000);
}


/** Municipios onde a base do estado esta pronta; o resto entra como um bloco por estado. */
async function unidades(a: Awaited<ReturnType<typeof apuracaoComUrnas>>): Promise<Unidade[]> {
  const t1 = await apuracao(1);
  if (a.br) definirCandidatos(a.br.cand.map((c) => c.n));
  const listas = await Promise.all(UFS.map(async (uf) => {
    const porMun = base[uf] ? await unidadesDoEstado(uf, base[uf]).catch(() => null) : null;
    if (porMun) return porMun;
    return a.ufs[uf] && t1.ufs[uf] ? [unidadeDoEstado(uf, a.ufs[uf], t1.ufs[uf])] : [];
  }));
  return listas.flat();
}

// linha do tempo da noite (2o turno), igual para todos e guardada em disco
const ARQ_FOTOS = process.env.ARQ_FOTOS ?? "linha-do-tempo.json";
const fotos: Foto[] = fs.existsSync(ARQ_FOTOS) ? JSON.parse(fs.readFileSync(ARQ_FOTOS, "utf8")) : [];
let fotosSalvas = fotos.length;
setInterval(() => {
  if (fotos.length !== fotosSalvas) { fs.writeFileSync(ARQ_FOTOS, JSON.stringify(fotos)); fotosSalvas = fotos.length; }
}, 30_000);

const PORTA = Number(process.env.PORTA) || 4100;
const ORIGENS = (process.env.ORIGENS ?? "https://2turno.github.io").split(",");

// Respostas prontas: o visitante recebe na hora o ultimo resultado calculado, e o servidor
// recalcula por tras quando ele passa de `ms` (muitos visitantes = uma conta so).
type Entrada = { em: number; valor?: unknown; calculando?: Promise<unknown> };
const cache = new Map<string, Entrada>();
function emCache<T>(chave: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(chave) ?? { em: 0 };
  cache.set(chave, c);
  if (Date.now() - c.em >= ms && !c.calculando) {
    c.calculando = fn()
      .then((v) => { c.valor = v; c.em = Date.now(); return v; })
      .finally(() => { c.calculando = undefined; });
    c.calculando.catch(() => {});
  }
  return (c.valor !== undefined ? Promise.resolve(c.valor) : c.calculando!) as Promise<T>;
}

const turnoDe = (v: string | null) => (v === "1" ? 1 : 2);

async function responder(url: URL): Promise<[number, unknown]> {
  const turno = turnoDe(url.searchParams.get("turno"));
  const uf = url.searchParams.get("uf") ?? "";
  const mun = url.searchParams.get("mun") ?? "";
  switch (url.pathname) {
    case "/api/brasil":
      return [200, await emCache(`br-${turno}`, 3000, async () => {
        const a = await apuracaoComUrnas(turno);
        if (turno === 2) registrarFoto(fotos, fotografar(a));
        return a;
      })];
    case "/api/uf":
      if (!UFS.includes(uf)) return [400, { erro: "UF inválida" }];
      return [200, await emCache(`uf-${turno}-${uf}`, 3000, () => municipiosUf(turno, uf))];
    case "/api/municipio":
      if (!UFS.includes(uf) || !/^\d{5}$/.test(mun)) return [400, { erro: "parâmetros inválidos" }];
      return [200, await emCache(`mun-${turno}-${uf}-${mun}`, 2000, () => municipio(turno, uf, mun))];
    case "/api/linha-do-tempo": {
      const desde = Number(url.searchParams.get("desde")) || 0;
      return [200, { fotos: fotos.filter((f) => f.t > desde) }];
    }
    case "/api/saude":
      return [200, { ok: true, memoriaMB: Math.round(process.memoryUsage().rss / 1e6), desde: inicio, tse: velocidade() }];
    default:
      return [404, { erro: "não encontrado" }];
  }
}

const inicio = new Date().toISOString();

http
  .createServer(async (req, res) => {
    const origem = req.headers.origin ?? "";
    if (ORIGENS.includes(origem) || ORIGENS.includes("*")) res.setHeader("Access-Control-Allow-Origin", origem || "*");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    try {
      const [status, corpo] = await responder(new URL(req.url ?? "/", "http://x"));
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(corpo));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ erro: String(e) }));
    }
  })
  .listen(PORTA, "127.0.0.1", () => console.log(`apuracao ouvindo em 127.0.0.1:${PORTA}`));

// Coleta continua do 2o turno no pais inteiro, mesmo sem ninguem com a pagina aberta.
async function aquecer() {
  try {
    const a = await responder(new URL("http://x/api/brasil")).then(([, v]) => v as Awaited<ReturnType<typeof apuracaoComUrnas>>);
    console.log(`${new Date().toLocaleTimeString("pt-BR")} urnas lidas: ${a.urnasLidas} · estados pelas urnas: ${a.ufsPeloBU.length} · ${velocidade().porSegundo} pedidos/s ao TSE (${velocidade().bloqueios} bloqueios) · memória ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
  } catch (e) {
    console.error("falha ao aquecer:", e);
  }
  setTimeout(aquecer, 15_000);
}
aquecer();
