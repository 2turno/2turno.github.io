export const fmt = (n: number) => n.toLocaleString("pt-BR");
export const fmtPct = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";
export const CORES = ["var(--a)", "var(--b)"];
export const HEX = ["#e3262b", "#1e63ff"];
export const NOMES_UF: Record<string, string> = {
  ac: "Acre", al: "Alagoas", am: "Amazonas", ap: "Amapá", ba: "Bahia", ce: "Ceará", df: "Distrito Federal",
  es: "Espírito Santo", go: "Goiás", ma: "Maranhão", mg: "Minas Gerais", ms: "Mato Grosso do Sul",
  mt: "Mato Grosso", pa: "Pará", pb: "Paraíba", pe: "Pernambuco", pi: "Piauí", pr: "Paraná",
  rj: "Rio de Janeiro", rn: "Rio Grande do Norte", ro: "Rondônia", rr: "Roraima", rs: "Rio Grande do Sul",
  sc: "Santa Catarina", se: "Sergipe", sp: "São Paulo", to: "Tocantins", zz: "Exterior", br: "Brasil",
};

/** Sigla para exibir (o TSE usa "zz" para o Exterior). */
export const sigla = (uf: string) => (uf === "zz" ? "EXT" : uf.toUpperCase());

export const REGIOES: { nome: string; ufs: string[] }[] = [
  { nome: "Norte", ufs: ["ac", "am", "ap", "pa", "ro", "rr", "to"] },
  { nome: "Nordeste", ufs: ["al", "ba", "ce", "ma", "pb", "pe", "pi", "rn", "se"] },
  { nome: "Centro-Oeste", ufs: ["df", "go", "ms", "mt"] },
  { nome: "Sudeste", ufs: ["es", "mg", "rj", "sp"] },
  { nome: "Sul", ufs: ["pr", "rs", "sc"] },
  { nome: "Exterior", ufs: ["zz"] },
];

/** "17h06" a partir de "25/10/2026 17:06:31". */
export const horaTSE = (atualizado: string) => {
  const m = atualizado.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}h${m[2]}` : "";
};
