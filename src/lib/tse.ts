// Acesso aos dados publicos de resultados do TSE (formato 2026: arquivos "-u.json").
export type Candidato = { n: string; nm: string; partido: string; foto: string; vap: number; pvap: number; eleito: boolean };
export type Resumo = {
  uf: string;
  cd?: string; // codigo TSE do municipio
  nome?: string;
  pst: number; // % de secoes totalizadas
  cand: Candidato[];
  comparecimento: number;
  abstencao: number;
  brancos: number;
  nulos: number;
  eleitorado: number;
  atualizado: string;
};
export type Apuracao = {
  turno: number;
  aguardando: boolean;
  eleicao: string;
  br: Resumo | null;
  ufs: Record<string, Resumo>;
  consultadoEm: string;
};

export const UFS = ["ac","al","am","ap","ba","ce","df","es","go","ma","mg","ms","mt","pa","pb","pe","pi","pr","rj","rn","ro","rr","rs","sc","se","sp","to","zz"]; // zz = Exterior

export const BASE = "https://resultados.tse.jus.br/oficial";
export const CICLO = process.env.TSE_CICLO ?? "ele2026";

/** Codigos do TSE: eleicao (resultados) e pleito (arquivos de urna) de cada turno. */
export const TURNOS: Record<number, { eleicao: string; pleito: string }> = {
  1: { eleicao: process.env.TSE_ELEICAO_T1 ?? "6257", pleito: process.env.TSE_PLEITO_T1 ?? "3220" },
  2: { eleicao: process.env.TSE_ELEICAO_T2 ?? "6258", pleito: process.env.TSE_PLEITO_T2 ?? "3221" },
};
export const turnoDe = (v: string | null) => (v === "1" ? 1 : 2);

const num = (v: unknown) => Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
const pct = (v: unknown) => Number(String(v ?? "0").replace(",", ".")) || 0;

export class NaoEncontrado extends Error {}

// ---------- controle de velocidade adaptativo ----------
// O TSE devolve 429 a quem pede rapido demais. Comecamos devagar, aceleramos enquanto ele
// responde bem e, ao primeiro 429, caimos pela metade e pausamos: acha sozinho o maximo tolerado.
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const ritmo = {
  porSegundo: Number(process.env.TSE_RPS) || 6,
  maximo: Number(process.env.TSE_RPS_MAX) || 25,
  pausaAte: 0,
  proximo: 0,
  bloqueios: 0,
};
export const velocidade = () => ({ porSegundo: Math.round(ritmo.porSegundo * 10) / 10, bloqueios: ritmo.bloqueios });

async function aguardarVez() {
  const agora = Date.now();
  const vez = Math.max(agora, ritmo.proximo, ritmo.pausaAte);
  ritmo.proximo = vez + 1000 / ritmo.porSegundo;
  if (vez > agora) await dormir(vez - agora);
}
function respostaOk() {
  ritmo.porSegundo = Math.min(ritmo.maximo, ritmo.porSegundo + 0.05);
}
function levouBloqueio() {
  ritmo.bloqueios++;
  ritmo.porSegundo = Math.max(1, ritmo.porSegundo / 2);
  ritmo.pausaAte = Date.now() + 5000;
}

/** GET com timeout, controle de velocidade e novas tentativas (o CDN do TSE oscila em noite de eleicao). */
export async function baixar(url: string, tentativas = 4): Promise<Response> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      await aguardarVez();
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
      if (r.status === 429) levouBloqueio();
      if (r.status === 404 || r.status === 403) throw new NaoEncontrado(`${r.status} ${url}`);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      respostaOk();
      return r;
    } catch (e) {
      if (e instanceof NaoEncontrado) throw e;
      ultimo = e;
      // 429 = TSE pedindo calma: espera mais a cada tentativa (1,5s, 3s, 6s), com um pouco de sorteio
      const lento = String(e).includes("429");
      await new Promise((ok) => setTimeout(ok, (lento ? 1500 * 2 ** i : 300 * (i + 1)) + Math.random() * 400));
    }
  }
  throw ultimo;
}
export const json = async <T = any>(url: string): Promise<T> => (await baixar(url)).json(); // eslint-disable-line @typescript-eslint/no-explicit-any

/** Executa tarefas com no maximo `n` simultaneas. */
export async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) {
      const k = i++;
      try { out[k] = { status: "fulfilled", value: await fn(itens[k]) }; }
      catch (e) { out[k] = { status: "rejected", reason: e }; }
    }
  }));
  return out;
}

type Bruto = {
  dg?: string; hg?: string; cdabr?: string;
  carg?: { cd: string; agr?: { par?: { sg?: string; cand?: Record<string, string>[] }[] }[] }[];
  s?: Record<string, string>; e?: Record<string, string>; v?: Record<string, string>;
};

const urlFoto = (sq: string, ele?: string) => `${BASE}/${CICLO}/${ele ?? TURNOS[2].eleicao}/fotos/br/${sq}.jpeg`;

export function normalizar(uf: string, d: Bruto & { ele?: string }): Resumo {
  const cargo = d.carg?.find((c) => c.cd === "1") ?? d.carg?.[0];
  const todos = (cargo?.agr ?? []).flatMap((a) => a.par ?? []).flatMap((p) => (p.cand ?? []).map((c): Record<string, string> => ({ ...c, sg: p.sg ?? "" })));
  // dois mais votados (no 2o turno sao os dois), em ordem fixa pelo numero para manter as cores
  const cand = todos
    .map((c) => ({ n: c.n, nm: c.nmu || c.nm, partido: c.sg, foto: urlFoto(c.sqcand, d.ele), vap: num(c.vap), pvap: pct(c.pvap), eleito: c.e === "s" && c.st === "Eleito" }))
    .sort((a, b) => b.vap - a.vap)
    .slice(0, 2)
    .sort((a, b) => Number(a.n) - Number(b.n));
  return {
    uf,
    cd: d.cdabr,
    pst: pct(d.s?.pst),
    cand,
    comparecimento: num(d.e?.c),
    abstencao: num(d.e?.a),
    brancos: num(d.v?.vb),
    nulos: num(d.v?.tvn),
    eleitorado: num(d.e?.te),
    atualizado: `${d.dg ?? ""} ${d.hg ?? ""}`.trim(),
  };
}

const urlResultado = (turno: number, uf: string, abr: string) => {
  const e = TURNOS[turno].eleicao;
  return `${BASE}/${CICLO}/${e}/dados/${uf}/${abr}-c0001-e${e.padStart(6, "0")}-u.json`;
};

export async function buscarApuracao(turno: number): Promise<Apuracao> {
  const res = await emParalelo(["br", ...UFS], 28, async (uf) => normalizar(uf, await json(urlResultado(turno, uf, uf))));
  const ok = res.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const falha = res.find((r) => r.status === "rejected" && !(r.reason instanceof NaoEncontrado));
  const br = ok.find((r) => r.uf === "br") ?? null;
  if (!br && falha) throw (falha as PromiseRejectedResult).reason;
  return {
    turno,
    aguardando: !br || br.pst === 0,
    eleicao: `${CICLO}/${TURNOS[turno].eleicao}`,
    br,
    ufs: Object.fromEntries(ok.filter((r) => r.uf !== "br").map((r) => [r.uf, r])),
    consultadoEm: new Date().toISOString(),
  };
}

// ---------- municipios ----------
type MunCfg = { cd: string; cdi: string; nm: string };
const cfgMun = new Map<number, { em: number; porUf: Record<string, MunCfg[]> }>();

export async function municipiosDaUf(turno: number, uf: string): Promise<MunCfg[]> {
  const c = cfgMun.get(turno);
  if (c && Date.now() - c.em < 3600_000) return c.porUf[uf] ?? [];
  const e = TURNOS[turno].eleicao;
  const cfg = await json<{ abr: { cd: string; mu: MunCfg[] }[] }>(`${BASE}/${CICLO}/${e}/config/mun-e${e.padStart(6, "0")}-cm.json`);
  const porUf = Object.fromEntries(cfg.abr.map((a) => [a.cd, a.mu]));
  cfgMun.set(turno, { em: Date.now(), porUf });
  return porUf[uf] ?? [];
}

/** Todos os municipios do pais (para a busca). */
export async function listaMunicipios(turno: number) {
  await municipiosDaUf(turno, "ac");
  const porUf = cfgMun.get(turno)!.porUf;
  return Object.entries(porUf).flatMap(([uf, ms]) => ms.map((m) => ({ uf, cd: m.cd, nm: m.nm })));
}

const cacheMun = new Map<string, { em: number; r: Resumo }>();

export async function resultadoMunicipio(turno: number, uf: string, mun: MunCfg): Promise<Resumo> {
  const k = `${turno}-${uf}-${mun.cd}`;
  const c = cacheMun.get(k);
  if (c && Date.now() - c.em < 6000) return c.r;
  const r = { ...normalizar(uf, await json(urlResultado(turno, uf, uf + mun.cd))), cd: mun.cd, nome: mun.nm };
  cacheMun.set(k, { em: Date.now(), r });
  return r;
}

export async function buscarMunicipios(turno: number, uf: string) {
  const lista = await municipiosDaUf(turno, uf);
  const res = await emParalelo(lista, 32, (m) => resultadoMunicipio(turno, uf, m));
  return lista.map((m, i) => {
    const r = res[i];
    return r.status === "fulfilled" ? r.value : ({ uf, cd: m.cd, nome: m.nm, pst: 0, cand: [], comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, eleitorado: 0, atualizado: "" } as Resumo);
  });
}
