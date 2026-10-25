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
  const foto = compacto ? "h-14 w-14" : "h-24 w-24 sm:h-36 sm:w-36";
  return (
    <div className={`flex min-w-0 items-end gap-3 sm:gap-5 ${dir ? "flex-row-reverse text-right" : ""}`}>
      <div className={`relative shrink-0 ${foto} overflow-hidden rounded-full ring-4`} style={{ "--tw-ring-color": CORES[i], background: CORES[i] } as React.CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.foto} alt={c.nm} className="h-full w-full object-cover object-top" />
      </div>
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${dir ? "justify-end" : ""}`}>
          <span className="px-1.5 py-0.5 font-serif text-sm font-bold" style={{ background: CORES[i] }}>{c.n}</span>
          <span className="rotulo">{c.partido}</span>
          {c.eleito && <span className="bg-[#16c172] px-2 py-0.5 font-serif text-sm font-extrabold text-black">ELEITO</span>}
        </div>
        <div className={`${compacto ? "text-2xl" : "text-3xl sm:text-5xl"} truncate font-serif font-extrabold leading-none`}>{c.nm}</div>
        <div className={`${compacto ? "text-4xl" : "text-6xl sm:text-8xl lg:text-9xl"} font-serif font-extrabold leading-[.85] tracking-tight`}>
          {fmtPct(pct)}
        </div>
        <div className={`mt-1 font-serif ${compacto ? "text-base" : "text-xl sm:text-2xl"} font-semibold text-[var(--mudo)]`}>{fmt(Math.round(votos))} votos</div>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
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
        <div className="mt-1.5 flex justify-between font-serif text-sm font-semibold text-[var(--mudo)]">
          <span>{a.nm}</span><span className="text-white">50%</span><span>{b.nm}</span>
        </div>
      )}
    </div>
  );
}
