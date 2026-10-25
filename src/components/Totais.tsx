import type { Resumo } from "@/lib/tse";
import { fmt, fmtPct } from "./fmt";
import { Dado } from "./aoVivo";

/** Bloco de numeros gerais: apurado, eleitorado, comparecimento, abstencao, brancos, nulos. */
export default function Totais({ r, colunas = 3 }: { r: Pick<Resumo, "pst" | "eleitorado" | "comparecimento" | "abstencao" | "brancos" | "nulos">; colunas?: 3 | 6 }) {
  const p = (v: number, base: number) => (base ? ` · ${fmtPct((v / base) * 100, 1)}` : "");
  return (
    <dl className={`grid grid-cols-2 border-t border-[var(--linha)] sm:grid-cols-3 ${colunas === 6 ? "lg:grid-cols-6" : ""}`}>
      <Dado k="Apurado" v={fmtPct(r.pst)} />
      <Dado k="Eleitorado" v={fmt(r.eleitorado)} />
      <Dado k="Comparecimento" v={fmt(r.comparecimento) + p(r.comparecimento, r.comparecimento + r.abstencao)} />
      <Dado k="Abstenção" v={fmt(r.abstencao) + p(r.abstencao, r.comparecimento + r.abstencao)} />
      <Dado k="Brancos" v={fmt(r.brancos) + p(r.brancos, r.comparecimento)} />
      <Dado k="Nulos" v={fmt(r.nulos) + p(r.nulos, r.comparecimento)} />
    </dl>
  );
}
