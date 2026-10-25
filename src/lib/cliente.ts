// Consultas feitas direto do navegador ao TSE (o site e estatico, sem servidor proprio).
import { buscarApuracao, buscarMunicipios, municipiosDaUf, resultadoMunicipio, type Apuracao, type Resumo } from "./tse";
import { escolasDoMunicipio, somaDoEstado, urnasPorMunicipio, type Escola, type Soma } from "./secoes";

// evita repetir a consulta nacional quando varias telas pedem o mesmo dado em sequencia
const cache = new Map<number, { em: number; p: Promise<Apuracao> }>();
export function apuracao(turno: number) {
  const c = cache.get(turno);
  if (c && Date.now() - c.em < 4000) return c.p;
  const p = buscarApuracao(turno);
  cache.set(turno, { em: Date.now(), p });
  p.catch(() => cache.delete(turno));
  return p;
}

/** Monta um Resumo a partir de uma soma de BUs, mantendo nomes/fotos do resumo oficial. */
function resumoDaSoma(oficial: Resumo, soma: Soma, pst: number): Resumo {
  const nominais = Object.values(soma.votos).reduce((t, v) => t + v, 0);
  return {
    ...oficial,
    pst,
    cand: oficial.cand.map((c) => {
      const vap = soma.votos[c.n] ?? 0;
      return { ...c, vap, pvap: nominais ? (vap / nominais) * 100 : 0, eleito: false };
    }),
    comparecimento: soma.comparecimento,
    abstencao: soma.aptos - soma.comparecimento,
    brancos: soma.brancos,
    nulos: soma.nulos,
  };
}

/** O TSE libera os BUs antes de atualizar os totais oficiais: usa o que estiver mais adiantado. */
const maisRecente = (oficial: Resumo, soma: Soma | undefined, pst: number) =>
  soma && soma.comparecimento > oficial.comparecimento ? { r: resumoDaSoma(oficial, soma, pst), urnas: true } : { r: oficial, urnas: false };

export async function municipiosUf(turno: number, uf: string) {
  const [municipios, urnas, soma, geral] = await Promise.all([
    buscarMunicipios(turno, uf),
    urnasPorMunicipio(turno, uf).catch(() => ({}) as Record<string, { liberadas: number; total: number }>),
    somaDoEstado(turno, uf).catch(() => null),
    apuracao(turno),
  ]);
  const oficialUf = geral.ufs[uf];
  const estado = oficialUf ? maisRecente(oficialUf, soma?.total, soma ? (soma.total.lidas / Math.max(1, soma.totalSecoes)) * 100 : 0) : null;
  return {
    municipios: municipios.map((m) => {
      const u = urnas[m.cd!];
      const x = maisRecente(m, soma?.porMun[m.cd!], u ? ((soma?.porMun[m.cd!]?.lidas ?? 0) / Math.max(1, u.total)) * 100 : 0);
      return { ...x.r, peloBU: x.urnas };
    }),
    urnas,
    estado: estado?.r ?? null,
    estadoPeloBU: !!estado?.urnas,
    lidas: soma?.total.lidas ?? 0,
    liberadas: soma?.liberadas ?? Object.values(urnas).reduce((n, u) => n + u.liberadas, 0),
    totalSecoes: soma?.totalSecoes ?? 0,
    coletando: !!soma?.coletando,
    grande: soma === null,
    consultadoEm: new Date().toISOString(),
  };
}

/**
 * Soma os boletins ja lidos. O TSE libera os BUs antes de atualizar o total oficial do
 * municipio, entao no comeco da apuracao a soma das urnas e mais recente que o oficial.
 */
function somaDasUrnas(oficial: Resumo, escolas: Escola[], lidas: number, totalSecoes: number): Resumo {
  let comp = 0, aptos = 0, brancos = 0, nulos = 0;
  const votos: Record<string, number> = {};
  for (const e of escolas) {
    comp += e.comparecimento; aptos += e.aptos; brancos += e.brancos; nulos += e.nulos;
    for (const [n, q] of Object.entries(e.votos)) votos[n] = (votos[n] ?? 0) + q;
  }
  const nominais = Object.values(votos).reduce((s, v) => s + v, 0);
  return {
    ...oficial,
    pst: totalSecoes ? (lidas / totalSecoes) * 100 : 0,
    cand: oficial.cand.map((c) => {
      const vap = votos[c.n] ?? 0;
      return { ...c, vap, pvap: nominais ? (vap / nominais) * 100 : 0, eleito: false };
    }),
    comparecimento: comp,
    abstencao: aptos - comp,
    brancos,
    nulos,
  };
}

export async function municipio(turno: number, uf: string, mun: string) {
  const cfg = (await municipiosDaUf(turno, uf)).find((m) => m.cd === mun);
  if (!cfg) throw new Error("município não encontrado");
  const [oficial, secoes] = await Promise.all([resultadoMunicipio(turno, uf, cfg), escolasDoMunicipio(turno, uf, mun)]);
  const urnas = somaDasUrnas(oficial, secoes.escolas, secoes.lidas, secoes.totalSecoes);
  const peloBU = urnas.comparecimento > oficial.comparecimento;
  return { resumo: peloBU ? urnas : oficial, fonte: peloBU ? ("urnas" as const) : ("oficial" as const), ...secoes, consultadoEm: new Date().toISOString() };
}
