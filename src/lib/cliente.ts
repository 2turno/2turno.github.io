// Consultas feitas direto do navegador ao TSE (o site e estatico, sem servidor proprio).
import { buscarApuracao, buscarMunicipios, municipiosDaUf, resultadoMunicipio, type Apuracao } from "./tse";
import { escolasDoMunicipio } from "./secoes";

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
  return { municipios: await buscarMunicipios(turno, uf), consultadoEm: new Date().toISOString() };
}

export async function municipio(turno: number, uf: string, mun: string) {
  const cfg = (await municipiosDaUf(turno, uf)).find((m) => m.cd === mun);
  if (!cfg) throw new Error("município não encontrado");
  const [resumo, secoes] = await Promise.all([resultadoMunicipio(turno, uf, cfg), escolasDoMunicipio(turno, uf, mun)]);
  return { resumo, ...secoes, consultadoEm: new Date().toISOString() };
}
