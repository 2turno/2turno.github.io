// Consultas feitas direto do navegador ao TSE (o site e estatico, sem servidor proprio).
import { buscarApuracao, buscarMunicipios, municipiosDaUf, resultadoMunicipio, type Apuracao, type Resumo } from "./tse";
import { escolasDoMunicipio, urnasPorMunicipio, type Escola } from "./secoes";

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

export async function municipiosUf(turno: number, uf: string) {
  const [municipios, urnas] = await Promise.all([buscarMunicipios(turno, uf), urnasPorMunicipio(turno, uf).catch(() => ({}))]);
  return { municipios, urnas: urnas as Record<string, { liberadas: number; total: number }>, consultadoEm: new Date().toISOString() };
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
