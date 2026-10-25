"use client";
import { useEffect, useRef, useState } from "react";
import type { Resumo } from "@/lib/tse";
import { CORES, fmt, fmtPct } from "./fmt";

/** Numero que "corre" ate o novo valor, como no placar da TV. */
function useContador(alvo: number, ms = 900) {
  const [v, setV] = useState(alvo);
  const de = useRef(alvo);
  useEffect(() => {
    const ini = de.current, t0 = performance.now();
    let id = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const atual = ini + (alvo - ini) * (1 - Math.pow(1 - k, 3));
      setV(atual);
      de.current = atual;
      if (k < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, ms]);
  return v;
}

function Lado({ c, i, compacto }: { c: Resumo["cand"][number]; i: number; compacto?: boolean }) {
  const pct = useContador(c.pvap);
  const votos = useContador(c.vap);
  const dir = i === 1;
  const foto = compacto ? "h-12 w-12 sm:h-14 sm:w-14" : "h-16 w-16 sm:h-28 sm:w-28 lg:h-36 lg:w-36";
  return (
    <div className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-5 ${dir ? "items-end text-right sm:flex-row-reverse" : "items-start"}`}>
      <div className={`relative shrink-0 ${foto} overflow-hidden rounded-full ring-4`} style={{ "--tw-ring-color": CORES[i], background: CORES[i] } as React.CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.foto} alt={c.nm} className="h-full w-full object-cover object-top" />
      </div>
      <div className="min-w-0">
        <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${dir ? "justify-end" : ""}`}>
          <span className="px-1.5 py-0.5 font-serif text-sm font-bold" style={{ background: CORES[i] }}>{c.n}</span>
          <span className="rotulo">{c.partido}</span>
          {c.eleito && <span className="bg-[#16c172] px-2 py-0.5 font-serif text-sm font-extrabold text-black">ELEITO</span>}
        </div>
        <div className={`${compacto ? "text-xl sm:text-2xl" : "text-2xl sm:text-4xl lg:text-5xl"} max-w-full truncate font-serif font-extrabold leading-none`}>{c.nm}</div>
        <div className={`${compacto ? "text-3xl sm:text-4xl" : "text-[11vw] sm:text-7xl lg:text-9xl"} font-serif font-extrabold leading-[.85] tracking-tight`}>
          {fmtPct(pct)}
        </div>
        <div className={`mt-1 font-serif ${compacto ? "text-sm sm:text-base" : "text-base sm:text-2xl"} font-semibold text-[var(--mudo)]`}>{fmt(Math.round(votos))} votos</div>
      </div>
    </div>
  );
}

/** Placar de transmissao: fotos, percentuais grandes e barra que disputa o centro. */
export default function Placar({ r, compacto }: { r: Resumo; compacto?: boolean }) {
  const [a, b] = r.cand;
  if (!a || !b) return null;
  const validos = a.vap + b.vap;
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <Lado c={a} i={0} compacto={compacto} />
        <Lado c={b} i={1} compacto={compacto} />
      </div>
      <div className={`relative mt-5 flex ${compacto ? "h-3" : "h-8 sm:h-10"} overflow-hidden bg-[var(--vazio)]`}>
        {validos > 0 && <>
          <div className="brilho h-full transition-[width] duration-1000 ease-out" style={{ width: `${a.pvap}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${CORES[0]} 70%, #000), ${CORES[0]})` }} />
          <div className="brilho h-full flex-1" style={{ background: `linear-gradient(90deg, ${CORES[1]}, color-mix(in srgb, ${CORES[1]} 70%, #000))` }} />
        </>}
        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white shadow-[0_0_12px_#fff]" />
      </div>
      {!compacto && (
        <div className="mt-1.5 flex justify-between gap-2 font-serif text-xs font-semibold text-[var(--mudo)] sm:text-sm">
          <span>{a.nm}</span><span className="text-white">50%</span><span>{b.nm}</span>
        </div>
      )}
    </div>
  );
}
