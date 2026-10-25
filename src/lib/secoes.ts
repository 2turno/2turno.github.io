// Resultados secao a secao (Boletins de Urna) agrupados por local de votacao (escola).
import { lerBU, type Secao } from "./bu";
import { BASE, CICLO, TURNOS, baixar, emParalelo, json } from "./tse";

export type Local = { nm: string; end: string; ba: string; lat: number | null; lon: number | null; el: number };
export type Escola = Local & {
  id: string; secoes: Secao[]; totalSecoes: number;
  aptos: number; comparecimento: number; brancos: number; nulos: number; votos: Record<string, number>;
};

// ---------- locais de votacao (gerados por scripts/gerar-locais.mjs) ----------
const locaisUf = new Map<string, Promise<Record<string, Local>>>();
function locais(uf: string) {
  if (!locaisUf.has(uf))
    locaisUf.set(uf, fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/locais/${uf}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return locaisUf.get(uf)!;
}

// ---------- secoes publicadas (config "cs" do pleito, por UF) ----------
type Cs = { abr: { mu: { cd: string; nm: string; zon: { cd: string; sec: { ns: string; da?: string }[] }[] }[] }[] };
const csCache = new Map<string, { em: number; p: Promise<Cs> }>();
function configSecoes(turno: number, uf: string) {
  const k = `${turno}-${uf}`;
  const c = csCache.get(k);
  if (c && Date.now() - c.em < 8000) return c.p;
  const p = TURNOS[turno].pleito;
  const prom = json<Cs>(`${BASE}/${CICLO}/arquivo-urna/${p}/config/${uf}/${uf}-p${p.padStart(6, "0")}-cs.json`);
  csCache.set(k, { em: Date.now(), p: prom });
  prom.catch(() => csCache.delete(k));
  return prom;
}

// ---------- boletins: baixados uma unica vez (BU totalizado nao muda) ----------
const bus = new Map<string, Secao>();
const coletando = new Set<string>();

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

/** Dispara (em segundo plano) o download dos BUs ainda nao lidos do municipio. */
function coletar(turno: number, uf: string, mun: string, pendentes: { zona: string; ns: string }[]) {
  const k = `${turno}-${uf}-${mun}`;
  if (coletando.has(k) || !pendentes.length) return;
  coletando.add(k);
  emParalelo(pendentes, 40, async ({ zona, ns }) => {
    const s = await baixarBU(turno, uf, mun, zona, ns);
    bus.set(`${k}-${Number(zona)}-${Number(ns)}`, s);
  }).finally(() => coletando.delete(k));
}

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

export async function escolasDoMunicipio(turno: number, uf: string, mun: string) {
  const [cs, idx] = await Promise.all([configSecoes(turno, uf), locais(uf)]);
  const m = cs.abr.flatMap((a) => a.mu).find((x) => x.cd === mun);
  if (!m) throw new Error("municipio nao encontrado");

  const secoes = m.zon.flatMap((z) => z.sec.map((s) => ({ zona: z.cd, ns: s.ns, publicada: !!s.da })));
  const k = `${turno}-${uf}-${mun}`;
  const chave = (s: { zona: string; ns: string }) => `${k}-${Number(s.zona)}-${Number(s.ns)}`;
  coletar(turno, uf, mun, secoes.filter((s) => s.publicada && !bus.has(chave(s))));

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
    coletando: coletando.has(k),
    // escolas ja apuradas primeiro, depois as maiores
    escolas: [...escolas.values()].sort((a, b) => Number(b.secoes.length > 0) - Number(a.secoes.length > 0) || b.aptos - a.aptos || b.el - a.el),
  };
}
