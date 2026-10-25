// Resultados secao a secao (Boletins de Urna) agrupados por local de votacao (escola).
import { lerBU, type Secao } from "./bu";
import { BASE, CICLO, TURNOS, baixar, json } from "./tse";

export type Local = { nm: string; end: string; ba: string; lat: number | null; lon: number | null; el: number };
export type Escola = Local & {
  id: string; secoes: Secao[]; totalSecoes: number;
  aptos: number; comparecimento: number; brancos: number; nulos: number; votos: Record<string, number>;
};

// ---------- locais de votacao (gerados por scripts/gerar-locais.mjs) ----------
const locaisUf = new Map<string, Promise<Record<string, Local>>>();
function locais(uf: string) {
  if (!locaisUf.has(uf))
    locaisUf.set(uf, fetch(`${process.env.LOCAIS_URL ?? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/locais"}/${uf}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return locaisUf.get(uf)!;
}

// ---------- secoes publicadas (config "cs" do pleito, por UF) ----------
type Cs = { abr: { mu: { cd: string; nm: string; zon: { cd: string; sec: { ns: string; da?: string }[] }[] }[] }[] };
const csCache = new Map<string, { em: number; p: Promise<Cs> }>();
function configSecoes(turno: number, uf: string, idadeMax = 8000) {
  const k = `${turno}-${uf}`;
  const c = csCache.get(k);
  if (c && Date.now() - c.em < idadeMax) return c.p;
  const p = TURNOS[turno].pleito;
  const prom = json<Cs>(`${BASE}/${CICLO}/arquivo-urna/${p}/config/${uf}/${uf}-p${p.padStart(6, "0")}-cs.json`);
  csCache.set(k, { em: Date.now(), p: prom });
  prom.catch(() => csCache.delete(k));
  return prom;
}

// ---------- boletins: baixados uma unica vez (BU totalizado nao muda) ----------
const bus = new Map<string, Secao>();

async function baixarBU(turno: number, uf: string, mun: string, zona: string, ns: string): Promise<Secao> {
  const p = TURNOS[turno].pleito;
  const dir = `${BASE}/${CICLO}/arquivo-urna/${p}/dados/${uf}/${mun}/${zona}/${ns}`;
  const aux = await json<{ hashes: { hash: string; st: string; arq: { nm: string; tp: string }[] }[] }>(
    `${dir}/p${p.padStart(6, "0")}-${uf}-m${mun}-z${zona}-s${ns}-aux.json`,
  );
  const h = [...aux.hashes].reverse().find((x) => x.arq.some((a) => a.tp === "bu"));
  if (!h) throw new Error("BU ainda nao publicado");
  const nome = h.arq.find((a) => a.tp === "bu")!.nm;
  const bytes = new Uint8Array(await (await baixar(`${dir}/${h.hash}/${nome}`)).arrayBuffer());
  return lerBU(bytes, Number(TURNOS[turno].eleicao));
}

// Fila unica de downloads: varias telas/municipios pedindo BUs ao mesmo tempo nao abrem
// centenas de conexoes; o municipio aberto na tela tem prioridade sobre a soma do estado.
// no servidor (VPS) pode ser bem maior; no navegador fica baixo para nao estourar o limite do TSE
const LIMITE = Number(process.env.BU_SIMULTANEOS) || 16;
const fila: { k: string; urgente: boolean; rodar: () => Promise<void> }[] = [];
const naFila = new Set<string>();
let ativos = 0;

function bombear() {
  while (ativos < LIMITE && fila.length) {
    const i = fila.findIndex((t) => t.urgente);
    const t = fila.splice(i >= 0 ? i : 0, 1)[0];
    ativos++;
    t.rodar().catch(() => {}).finally(() => {
      ativos--;
      naFila.delete(t.k);
      bombear();
    });
  }
}

/** Enfileira os BUs ainda nao lidos (os que falharem voltam na proxima atualizacao). */
function coletar(turno: number, uf: string, mun: string, pendentes: { zona: string; ns: string }[], urgente: boolean) {
  const base = `${turno}-${uf}-${mun}`;
  for (const { zona, ns } of pendentes) {
    const k = `${base}-${Number(zona)}-${Number(ns)}`;
    if (naFila.has(k)) {
      if (urgente) fila.forEach((t) => t.k === k && (t.urgente = true));
      continue;
    }
    naFila.add(k);
    fila.push({ k, urgente, rodar: async () => { bus.set(k, await baixarBU(turno, uf, mun, zona, ns)); } });
  }
  bombear();
}
const coletandoMun = (turno: number, uf: string, mun: string) => {
  const base = `${turno}-${uf}-${mun}-`;
  for (const k of naFila) if (k.startsWith(base)) return true;
  return false;
};

/** Quantas urnas de cada municipio o TSE ja liberou (um unico arquivo por UF). */
export async function urnasPorMunicipio(turno: number, uf: string) {
  const cs = await configSecoes(turno, uf);
  const out: Record<string, { liberadas: number; total: number }> = {};
  for (const m of cs.abr.flatMap((a) => a.mu)) {
    const secs = m.zon.flatMap((z) => z.sec);
    out[m.cd] = { liberadas: secs.filter((s) => s.da).length, total: secs.length };
  }
  return out;
}

export type Soma = { lidas: number; aptos: number; comparecimento: number; brancos: number; nulos: number; votos: Record<string, number> };
const somaVazia = (): Soma => ({ lidas: 0, aptos: 0, comparecimento: 0, brancos: 0, nulos: 0, votos: {} });
function acumular(s: Soma, bu: Secao) {
  s.lidas++; s.aptos += bu.aptos; s.comparecimento += bu.comparecimento; s.brancos += bu.brancos; s.nulos += bu.nulos;
  for (const [n, q] of Object.entries(bu.votos)) s.votos[n] = (s.votos[n] ?? 0) + q;
}

/** Acima disso o total oficial do TSE ja estara andando; nao vale baixar o estado inteiro no navegador. */
export const MAX_URNAS_ESTADO = Number(process.env.MAX_URNAS_ESTADO) || 6000;

/**
 * Soma dos BUs liberados no estado inteiro e por municipio. Retorna `null` quando ha urnas
 * demais para baixar no navegador (nesse ponto o total oficial do TSE ja deve estar em dia).
 */
export async function somaDoEstado(turno: number, uf: string, op: { idadeMax?: number; limite?: number; baixar?: boolean } = {}) {
  const cs = await configSecoes(turno, uf, op.idadeMax);
  const muns = cs.abr.flatMap((a) => a.mu);
  const liberadas = muns.reduce((n, m) => n + m.zon.reduce((k, z) => k + z.sec.filter((s) => s.da).length, 0), 0);
  const totalSecoes = muns.reduce((n, m) => n + m.zon.reduce((k, z) => k + z.sec.length, 0), 0);
  if (liberadas > (op.limite ?? MAX_URNAS_ESTADO)) return null;

  const total = somaVazia();
  const porMun: Record<string, Soma> = {};
  for (const m of muns) {
    const base = `${turno}-${uf}-${m.cd}`;
    const pend: { zona: string; ns: string }[] = [];
    for (const z of m.zon) for (const s of z.sec) {
      if (!s.da) continue;
      const bu = bus.get(`${base}-${Number(z.cd)}-${Number(s.ns)}`);
      if (!bu) { pend.push({ zona: z.cd, ns: s.ns }); continue; }
      acumular(total, bu);
      acumular((porMun[m.cd] ??= somaVazia()), bu);
    }
    if (op.baixar !== false) coletar(turno, uf, m.cd, pend, false);
  }
  return { total, porMun, liberadas, totalSecoes, coletando: total.lidas < liberadas };
}

/** Urnas liberadas no estado, sem baixar nenhum boletim. */
export async function liberadasNoEstado(turno: number, uf: string, idadeMax?: number) {
  const cs = await configSecoes(turno, uf, idadeMax);
  return cs.abr.flatMap((a) => a.mu).reduce((n, m) => n + m.zon.reduce((k, z) => k + z.sec.filter((s) => s.da).length, 0), 0);
}

export async function escolasDoMunicipio(turno: number, uf: string, mun: string) {
  const [cs, idx] = await Promise.all([configSecoes(turno, uf), locais(uf)]);
  const m = cs.abr.flatMap((a) => a.mu).find((x) => x.cd === mun);
  if (!m) throw new Error("municipio nao encontrado");

  const secoes = m.zon.flatMap((z) => z.sec.map((s) => ({ zona: z.cd, ns: s.ns, publicada: !!s.da })));
  const k = `${turno}-${uf}-${mun}`;
  const chave = (s: { zona: string; ns: string }) => `${k}-${Number(s.zona)}-${Number(s.ns)}`;
  coletar(turno, uf, mun, secoes.filter((s) => s.publicada && !bus.has(chave(s))), true);

  const escolas = new Map<string, Escola>();
  const vazia = (id: string): Escola => ({
    ...(idx[id] ?? { nm: `Local ${id.split("-")[2]}`, end: "", ba: "", lat: null, lon: null, el: 0 }),
    id, secoes: [], totalSecoes: 0, aptos: 0, comparecimento: 0, brancos: 0, nulos: 0, votos: {},
  });
  for (const s of secoes) {
    const bu = bus.get(chave(s));
    if (!bu) continue;
    const id = `${mun}-${bu.zona}-${bu.local}`;
    const e = escolas.get(id) ?? vazia(id);
    escolas.set(id, e);
    e.secoes.push(bu);
    e.aptos += bu.aptos;
    e.comparecimento += bu.comparecimento;
    e.brancos += bu.brancos;
    e.nulos += bu.nulos;
    for (const [n, q] of Object.entries(bu.votos)) e.votos[n] = (e.votos[n] ?? 0) + q;
  }
  // locais que ainda nao tem nenhuma secao lida aparecem vazios (para o mapa/lista ficarem completos)
  for (const [id, l] of Object.entries(idx)) if (id.startsWith(mun + "-") && !escolas.has(id)) escolas.set(id, { ...vazia(id), ...l });

  return {
    totalSecoes: secoes.length,
    publicadas: secoes.filter((s) => s.publicada).length,
    lidas: secoes.filter((s) => bus.has(chave(s))).length,
    coletando: coletandoMun(turno, uf, mun),
    // escolas ja apuradas primeiro, depois as maiores
    escolas: [...escolas.values()].sort((a, b) => Number(b.secoes.length > 0) - Number(a.secoes.length > 0) || b.aptos - a.aptos || b.el - a.el),
  };
}
