// De onde as telas pegam os dados: primeiro o servidor da VPS (que ja tem tudo somado);
// se ele nao responder, o proprio navegador busca no TSE (modo antigo, mais limitado).
import * as local from "./cliente";

const API = process.env.NEXT_PUBLIC_API ?? "";
let servidorFora = 0; // momento da ultima falha: evita insistir num servidor caido a cada 5s

async function doServidor<T>(caminho: string, reserva: () => Promise<T>): Promise<T> {
  if (API && Date.now() - servidorFora > 60_000) {
    try {
      const r = await fetch(API + caminho, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (r.ok) return (await r.json()) as T;
    } catch {}
    servidorFora = Date.now();
  }
  return reserva();
}

const q = (turno: number) => (turno === 1 ? "&turno=1" : "");

export const brasil = (turno: number) =>
  doServidor(`/api/brasil?x=1${q(turno)}`, () => local.apuracaoComUrnas(turno));

export const estado = (turno: number, uf: string) =>
  doServidor(`/api/uf?uf=${uf}${q(turno)}`, () => local.municipiosUf(turno, uf));

export const municipio = (turno: number, uf: string, mun: string) =>
  doServidor(`/api/municipio?uf=${uf}&mun=${mun}${q(turno)}`, () => local.municipio(turno, uf, mun));
