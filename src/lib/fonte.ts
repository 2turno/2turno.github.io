// De onde as telas pegam os dados: primeiro o servidor (que ja tem o pais inteiro somado);
// se ele nao responder, o proprio navegador busca no TSE (modo antigo, com limite de urnas).
import * as local from "./cliente";
import { prever, registrar, type Ponto, type Previsao } from "./previsao";

const serieLocal: Ponto[] = [];
type Brasil = Awaited<ReturnType<typeof local.apuracaoComUrnas>> & { previsao?: Previsao | null; serie?: Ponto[] };

// O endereco do servidor fica em /api.json (publicado com o site), porque o tunel pode mudar de URL.
let api: Promise<string> | null = null;
let apiLidaEm = 0;
function enderecoApi() {
  if (!api || Date.now() - apiLidaEm > 120_000) {
    apiLidaEm = Date.now();
    api = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: { url?: string }) => (j.url ?? "").replace(/\/$/, ""))
      .catch(() => "");
  }
  return api;
}

let servidorFora = 0; // momento da ultima falha: evita insistir num servidor caido a cada 5s

async function doServidor<T>(caminho: string, reserva: () => Promise<T>): Promise<T> {
  const base = await enderecoApi();
  if (base && Date.now() - servidorFora > 60_000) {
    try {
      const r = await fetch(base + caminho, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (r.ok) return (await r.json()) as T;
    } catch {}
    servidorFora = Date.now();
  }
  return reserva();
}

const q = (turno: number) => (turno === 1 ? "&turno=1" : "");

export const brasil = (turno: number) =>
  doServidor<Brasil>(`/api/brasil?x=1${q(turno)}`, async () => {
    const a = await local.apuracaoComUrnas(turno);
    if (turno !== 2) return a;
    const t1 = await local.apuracao(1).catch(() => null);
    const previsao = t1 ? prever(local.unidadesDosEstados(a, t1)) : null;
    if (previsao) registrar(serieLocal, previsao);
    return { ...a, previsao, serie: [...serieLocal] };
  });

export const estado = (turno: number, uf: string) =>
  doServidor(`/api/uf?uf=${uf}${q(turno)}`, () => local.municipiosUf(turno, uf));

export const municipio = (turno: number, uf: string, mun: string) =>
  doServidor(`/api/municipio?uf=${uf}&mun=${mun}${q(turno)}`, () => local.municipio(turno, uf, mun));
