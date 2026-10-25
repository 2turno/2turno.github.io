// Previsao de vitoria em tempo real, comparando cada lugar com ele mesmo no 1o turno.
//
// Para cada unidade (municipio, ou estado quando nao ha dados municipais):
//   - base   = divisao A x B dessa unidade no 1o turno;
//   - swing  = quanto o 2o turno ja apurado ali esta diferente do 1o turno, estimado em camadas:
//              municipio -> estado -> pais (cada camada "empresta" da de cima quando tem poucos votos);
//   - urnas que faltam = base + swing.
// Como o swing varia pouco entre cidades vizinhas, os erros se compensam e a margem fica pequena.

export type Ponto = {
  t: number;       // horario (ms)
  apurado: number; // % dos votos validos esperados que ja foram contados
  pA: number;      // % de votos validos projetada para o candidato A (o de menor numero)
  li: number;      // limite inferior (95%)
  ls: number;      // limite superior (95%)
  probA: number;   // chance de vitoria de A (0 a 100)
};
export type Previsao = Ponto & { swing: number; unidades: number; porUf: Record<string, { pA: number; probA: number; apurado: number }> };

/** Uma unidade geografica: municipio (melhor) ou estado. */
export type Unidade = {
  uf: string;
  p: number; // fracao de A no 1o turno (A / (A + B))
  E: number; // votos validos (A + B) esperados no 2o turno, pelo 1o turno
  a: number; // votos de A ja contados no 2o turno
  n: number; // votos A + B ja contados no 2o turno
  f: number; // fracao das urnas da unidade ja contadas (0 a 1)
};

// "votos de confianca" de cada camada: abaixo disso a estimativa puxa para a camada de cima
const K_PAIS = 5_000;
const K_ESTADO = 20_000;
const K_MUN = 1_500;
// desvios tipicos do swing (fracao de voto), calibrados de forma conservadora
const SD_MUN = 0.035;   // quanto uma cidade foge do swing do seu estado
const SD_ESTADO = 0.02; // quanto um estado foge do swing do pais
// As primeiras urnas nao sao uma amostra aleatoria (vem de poucas cidades, do mesmo tipo):
// enquanto falta muito, sobra um erro de selecao que so some quando a apuracao avanca.
const VIES_INICIO = 0.03;

/** Distribuicao normal acumulada. */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const limitar = (v: number) => Math.min(0.99, Math.max(0.01, v));

export function prever(unidades: Unidade[], agora = Date.now()): Previsao | null {
  const total = unidades.reduce((s, u) => s + u.n, 0);
  if (!unidades.length || total === 0) return null;

  // swing nacional (encolhido para 0 com poucos votos)
  const desvio = (us: Unidade[]) => us.reduce((s, u) => s + (u.n ? u.n * (u.a / u.n - u.p) : 0), 0);
  const swingPais = desvio(unidades) / (total + K_PAIS);

  const porEstado = new Map<string, Unidade[]>();
  for (const u of unidades) (porEstado.get(u.uf) ?? porEstado.set(u.uf, []).get(u.uf)!).push(u);

  let somaA = 0, somaT = 0, varMun = 0, varEst = 0, faltamPais = 0;
  const porUf: Previsao["porUf"] = {};
  for (const [uf, us] of porEstado) {
    const nUf = us.reduce((s, u) => s + u.n, 0);
    const swingUf = (desvio(us) + K_ESTADO * swingPais) / (nUf + K_ESTADO);
    let aUf = 0, tUf = 0, faltamUf = 0, varUf = 0;
    for (const u of us) {
      const o = u.n ? u.a / u.n : 0;
      const swingMun = (u.n * (o - u.p) + K_MUN * swingUf) / (u.n + K_MUN);
      // votos que faltam: pelo ritmo das urnas da propria unidade; sem urnas, pelo 1o turno
      const faltam = u.f > 0.02 ? (u.n * (1 - u.f)) / u.f : Math.max(0, u.E - u.n);
      const r = limitar(u.p + swingMun);
      aUf += u.a + r * faltam;
      tUf += u.n + faltam;
      faltamUf += faltam;
      // dentro da cidade, as urnas lidas primeiro tambem podem nao representar o resto
      const fMun = u.n + faltam > 0 ? u.n / (u.n + faltam) : 0;
      varUf += (SD_MUN * Math.sqrt(Math.max(K_MUN / (u.n + K_MUN), 1 - fMun)) * faltam) ** 2;
    }
    const fracUf = nUf / Math.max(1, nUf + us.reduce((t, u) => t + (u.f > 0.02 ? (u.n * (1 - u.f)) / u.f : Math.max(0, u.E - u.n)), 0));
    const sdSwingUf = SD_ESTADO * Math.sqrt(Math.max(K_ESTADO / (nUf + K_ESTADO), 1 - fracUf));
    varMun += varUf;
    varEst += (sdSwingUf * faltamUf) ** 2;
    faltamPais += faltamUf;
    somaA += aUf;
    somaT += tUf;
    const pUf = tUf ? aUf / tUf : 0.5;
    const sdUf = tUf ? Math.sqrt(varUf + (sdSwingUf * faltamUf) ** 2) / tUf : 1;
    porUf[uf] = { pA: pUf * 100, probA: phi((pUf - 0.5) / Math.max(sdUf, 1e-5)) * 100, apurado: tUf ? (nUf / tUf) * 100 : 0 };
  }

  const pA = somaA / somaT;
  // swing nacional: precisao depende de QUANTAS cidades contribuiram (amostra por conglomerados)
  const pesos = unidades.filter((u) => u.n > 0).map((u) => u.n);
  const somaP = pesos.reduce((x, y) => x + y, 0), somaP2 = pesos.reduce((x, y) => x + y * y, 0);
  const cidadesEfetivas = somaP2 ? (somaP * somaP) / somaP2 : 0;
  const F = total / somaT;
  const sdPais = Math.sqrt(SD_MUN ** 2 / Math.max(1, cidadesEfetivas) + (VIES_INICIO * (1 - F)) ** 2);
  const sd = Math.sqrt(varMun + varEst + (sdPais * faltamPais) ** 2) / somaT;
  const pct = (v: number) => Math.min(100, Math.max(0, v * 100));
  return {
    t: agora,
    apurado: pct(total / somaT),
    pA: pA * 100,
    li: pct(pA - 1.96 * sd),
    ls: pct(pA + 1.96 * sd),
    probA: phi((pA - 0.5) / Math.max(sd, 1e-6)) * 100,
    swing: swingPais * 100,
    unidades: unidades.length,
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
