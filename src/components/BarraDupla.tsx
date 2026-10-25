import { CORES } from "./fmt";

type Par = { cand: { vap: number; pvap: number }[] };

/** Barra fina A x B com marca dos 50%. */
export default function BarraDupla({ r, alta = "h-1.5" }: { r: Par; alta?: string }) {
  const [a, b] = r.cand;
  const tem = a && b && a.vap + b.vap > 0;
  return (
    <span className={`relative block ${alta} bg-[var(--vazio)]`}>
      {tem && <>
        <span className="absolute inset-y-0 left-0 transition-[width] duration-700" style={{ width: `${a.pvap}%`, background: CORES[0] }} />
        <span className="absolute inset-y-0 right-0 transition-[width] duration-700" style={{ width: `${b.pvap}%`, background: CORES[1] }} />
      </>}
      <span className="absolute -inset-y-1 left-1/2 w-px bg-[var(--tinta)]" />
    </span>
  );
}
