// Previsao de vitoria em tempo real, usando somente os dados do 2o turno.
//
// Cada estado mistura os votos ja contados com a media nacional do 2o turno (para as urnas que
// faltam); estados sem nenhuma urna seguem a media nacional. O tamanho final de cada estado vem
// do eleitorado x comparecimento observado hoje. A incerteza encolhe conforme a apuracao avanca.
import type { Apuracao, Resumo } from "./tse";

export type Ponto = {
  t: number;       // horario (ms)
  apurado: number; // % dos votos validos esperados que ja foram contados
  pA: number;      // % de votos validos projetada para o candidato A (o de menor numero)
  li: number;      // limite inferior (95%)
  ls: number;      // limite superior (95%)
  probA: number;   // chance de vitoria de A (0 a 100)
};
export type Previsao = Ponto & { porUf: Record<string, { pA: number; probA: number; apurado: number }> };

const K = 20_000;           // peso da media nacional: com poucas urnas o estado segue o pais
const ERRO_ESTADO = 0.08;   // quanto um estado sem urnas pode fugir da media nacional
const ERRO_COMUM = 0.04;    // erro que atinge todos juntos: as primeiras urnas nao sao uma amostra aleatoria
const ERRO_INICIO = 0.12;   // extra enquanto ha poucos votos: a media nacional ainda vem de poucas cidades
const VOTOS_CONFIAVEIS = 500_000;
const COMPARECIMENTO = 0.79; // usado ate haver urnas suficientes para medir o de hoje
const VALIDOS = 0.94;       // fracao do comparecimento que vira voto valido

/** Distribuicao normal acumulada. */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const doisLados = (r?: Resumo) => {
  const a = r?.cand[0]?.vap ?? 0, b = r?.cand[1]?.vap ?? 0;
  return { a, b, n: a + b };
};

export function calcularPrevisao(atual: Apuracao, agora = Date.now()): Previsao | null {
  const lista = Object.values(atual.ufs);
  const total = lista.reduce((s, r) => s + doisLados(r).n, 0);
  if (!lista.length || total === 0) return null;

  // media nacional do 2o turno ate agora e comparecimento observado hoje
  const somaA = lista.reduce((s, r) => s + doisLados(r).a, 0);
  const media = somaA / total;
  const comp = lista.reduce((s, r) => s + r.comparecimento, 0);
  const aptosVistos = lista.reduce((s, r) => s + r.comparecimento + r.abstencao, 0);
  const taxa = aptosVistos > 50_000 ? comp / aptosVistos : COMPARECIMENTO;

  let projA = 0, projW = 0, variancia = 0, contados = 0;
  const porUf: Previsao["porUf"] = {};
  for (const r of lista) {
    const { a, n } = doisLados(r);
    const o = n ? a / n : media;
    const W = Math.max(n, r.eleitorado * taxa * VALIDOS);
    const f = Math.min(1, n / W);
    const resto = (media * K + o * n) / (K + n); // tendencia das urnas que faltam
    const final = (o * n + resto * (W - n)) / W;
    const sd = (Math.sqrt((resto * (1 - resto)) / (K + n)) + ERRO_ESTADO * (1 - f)) * (1 - f);
    projA += final * W;
    projW += W;
    variancia += (sd * W) ** 2;
    contados += n;
    porUf[r.uf] = { pA: final * 100, probA: phi((final - 0.5) / Math.max(sd, 1e-4)) * 100, apurado: f * 100 };
  }

  const F = Math.min(1, contados / projW);
  const pA = projA / projW;
  const poucos = Math.max(0, 1 - total / VOTOS_CONFIAVEIS);
  const sd = Math.sqrt(variancia) / projW + (ERRO_COMUM + ERRO_INICIO * poucos) * (1 - F);
  return {
    t: agora,
    apurado: F * 100,
    pA: pA * 100,
    li: (pA - 1.96 * sd) * 100,
    ls: (pA + 1.96 * sd) * 100,
    probA: phi((pA - 0.5) / Math.max(sd, 1e-5)) * 100,
    porUf,
  };
}

/** Acrescenta um ponto a serie, evitando repetir pontos identicos. */
export function registrar(serie: Ponto[], p: Ponto, limite = 3000) {
  const u = serie[serie.length - 1];
  if (u && Math.abs(u.pA - p.pA) < 0.005 && Math.abs(u.apurado - p.apurado) < 0.005 && p.t - u.t < 300_000) return serie;
  const { t, apurado, pA, li, ls, probA } = p;
  serie.push({ t, apurado, pA, li, ls, probA });
  if (serie.length > limite) serie.splice(0, serie.length - limite);
  return serie;
}
