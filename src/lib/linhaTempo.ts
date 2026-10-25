// Linha do tempo da apuracao: "fotos" compactas do Brasil e de cada estado ao longo da noite,
// para rever como o mapa e o placar estavam em cada horario.
import type { Apuracao, Resumo } from "./tse";

/** [votos A, votos B, % apurado, comparecimento, abstencao, brancos, nulos] */
type Linha = [number, number, number, number, number, number, number];
export type Foto = { t: number; d: Record<string, Linha> };

const compactar = (r: Resumo): Linha => [
  r.cand[0]?.vap ?? 0, r.cand[1]?.vap ?? 0, Math.round(r.pst * 100) / 100, r.comparecimento, r.abstencao, r.brancos, r.nulos,
];

export function fotografar(a: Apuracao, t = Date.now()): Foto | null {
  if (!a.br) return null;
  const d: Record<string, Linha> = { br: compactar(a.br) };
  for (const [uf, r] of Object.entries(a.ufs)) d[uf] = compactar(r);
  return { t, d };
}

/** Guarda a foto so se algo mudou desde a anterior. */
export function registrarFoto(lista: Foto[], f: Foto | null, limite = 4000) {
  if (!f) return lista;
  const u = lista[lista.length - 1];
  if (u && JSON.stringify(u.d) === JSON.stringify(f.d)) return lista;
  lista.push(f);
  if (lista.length > limite) lista.splice(0, lista.length - limite);
  return lista;
}

/** Remonta a apuracao de um momento usando a atual como molde (nomes, fotos, eleitorado). */
export function reconstruir(f: Foto, molde: Apuracao): Apuracao {
  const volta = (r: Resumo, l?: Linha): Resumo => {
    if (!l) return { ...r, pst: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, cand: r.cand.map((c) => ({ ...c, vap: 0, pvap: 0, eleito: false })) };
    const [va, vb, pst, comparecimento, abstencao, brancos, nulos] = l;
    const t = va + vb;
    const v = [va, vb];
    return {
      ...r, pst, comparecimento, abstencao, brancos, nulos,
      atualizado: new Date(f.t).toLocaleString("pt-BR"),
      cand: r.cand.map((c, i) => ({ ...c, vap: v[i] ?? 0, pvap: t ? ((v[i] ?? 0) / t) * 100 : 0, eleito: false })),
    };
  };
  return {
    ...molde,
    br: molde.br ? volta(molde.br, f.d.br) : null,
    ufs: Object.fromEntries(Object.entries(molde.ufs).map(([uf, r]) => [uf, volta(r, f.d[uf])])),
    consultadoEm: new Date(f.t).toISOString(),
  };
}
