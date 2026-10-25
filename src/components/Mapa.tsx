"use client";
import { useRef, useState } from "react";
import mapa from "@/lib/mapa.json";
import type { Resumo } from "@/lib/tse";
import { HEX, NOMES_UF, fmtPct } from "./fmt";

type Props = { ufs: Record<string, Resumo>; selecionada: string; onSelecionar: (uf: string) => void; modo: "geo" | "blocos" };

const PEQUENOS = ["df", "se", "al", "rn", "pb", "es", "rj"];

// mapa em blocos: cada estado ocupa o mesmo espaco (coluna, linha)
const BLOCOS: Record<string, [number, number]> = {
  rr: [1, 0], ap: [3, 0],
  am: [1, 1], pa: [2, 1], ma: [3, 1], ce: [4, 1], rn: [5, 1],
  ac: [0, 2], ro: [1, 2], to: [2, 2], pi: [3, 2], pe: [4, 2], pb: [5, 2],
  mt: [1, 3], go: [2, 3], ba: [3, 3], se: [4, 3], al: [5, 3],
  ms: [1, 4], df: [2, 4], mg: [3, 4], es: [4, 4],
  pr: [1, 5], sp: [2, 5], rj: [3, 5],
  sc: [1, 6],
  rs: [1, 7],
};

/** Cor do lider, com intensidade proporcional a vantagem (0 a 20 p.p.). */
function cor(r?: Resumo) {
  if (!r || r.cand.length < 2 || r.cand[0].vap + r.cand[1].vap === 0) return { fill: "var(--vazio)", op: 1, lider: -1 };
  const [a, b] = r.cand;
  const margem = Math.abs(a.pvap - b.pvap);
  const lider = a.vap >= b.vap ? 0 : 1;
  return { fill: HEX[lider], op: 0.22 + Math.min(margem / 20, 1) * 0.78, lider };
}

export default function Mapa({ ufs, selecionada, onSelecionar, modo }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
  const h = hover ? ufs[hover.uf] : undefined;
  const largura = box.current?.clientWidth ?? 0;

  const mover = (uf: string) => (ev: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    setHover({ uf, x: ev.clientX - r.left, y: ev.clientY - r.top });
  };
  const clicar = (uf: string) => () => onSelecionar(selecionada === uf ? "br" : uf);

  return (
    <div ref={box} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {modo === "geo" ? (
        <svg viewBox={`0 0 ${mapa.w} ${mapa.h}`} className="mx-auto h-auto max-h-[78vh] w-full" role="img" aria-label="Mapa do Brasil por estado">
          {mapa.estados.map((e) => {
            const c = cor(ufs[e.uf]);
            return (
              <path key={e.uf} d={e.d} className="estado" fill={c.fill} fillOpacity={c.op}
                stroke="var(--papel)" strokeWidth={1.2} onClick={clicar(e.uf)} onMouseMove={mover(e.uf)} />
            );
          })}
          {/* contorno do selecionado por cima de todos */}
          {mapa.estados.filter((e) => e.uf === selecionada || e.uf === hover?.uf).map((e) => (
            <path key={"s" + e.uf} d={e.d} fill="none" stroke="var(--tinta)" strokeWidth={e.uf === selecionada ? 3 : 1.5} pointerEvents="none" />
          ))}
          {mapa.estados.map((e) => (
            <text key={e.uf} x={e.cx} y={e.cy} textAnchor="middle" dominantBaseline="middle" pointerEvents="none"
              fontFamily="var(--fonte-mono)" fontSize={PEQUENOS.includes(e.uf) ? 10 : 13} fontWeight={600}
              fill={cor(ufs[e.uf]).op > 0.6 ? "#fff" : "var(--tinta)"}>
              {e.uf.toUpperCase()}
            </text>
          ))}
        </svg>
      ) : (
        <svg viewBox="0 0 600 690" className="mx-auto h-auto max-h-[78vh] w-full" role="img" aria-label="Mapa em blocos por estado">
          {Object.entries(BLOCOS).map(([uf, [col, lin]]) => {
            const r = ufs[uf];
            const c = cor(r);
            const x = col * 98 + 10, y = lin * 84 + 10;
            const sel = selecionada === uf;
            const claro = c.op > 0.6;
            return (
              <g key={uf} onClick={clicar(uf)} onMouseMove={mover(uf)} className="cursor-pointer">
                <rect x={x} y={y} width={92} height={78} className="estado" fill={c.fill} fillOpacity={c.op}
                  stroke="var(--tinta)" strokeWidth={sel ? 3 : 0} />
                <text x={x + 8} y={y + 22} fontFamily="var(--fonte-mono)" fontSize={15} fontWeight={700}
                  fill={claro ? "#fff" : "var(--tinta)"}>{uf.toUpperCase()}</text>
                {r && c.lider >= 0 && (
                  <text x={x + 8} y={y + 66} fontFamily="var(--fonte-mono)" fontSize={13}
                    fill={claro ? "#fff" : "var(--tinta)"}>{fmtPct(r.cand[c.lider].pvap, 1)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {hover && (
        <div className="pointer-events-none absolute z-10 hidden w-60 border border-[var(--linha)] bg-[var(--papel)] p-3 shadow-2xl rounded-sm sm:block"
          style={{ left: Math.max(0, Math.min(hover.x + 16, largura - 250)), top: hover.y + 16 }}>
          <div className="flex items-baseline justify-between gap-2 border-b border-[var(--linha)] pb-1.5">
            <span className="font-serif text-xl leading-none">{NOMES_UF[hover.uf]}</span>
            <span className="rotulo">{h ? fmtPct(h.pst, 1) : "—"}</span>
          </div>
          {h ? h.cand.map((c, i) => (
            <div key={c.n} className="mt-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 truncate">
                <i className="inline-block h-2.5 w-2.5" style={{ background: HEX[i] }} />{c.nm}
              </span>
              <b className="font-mono">{fmtPct(c.pvap)}</b>
            </div>
          )) : <div className="mt-1.5 text-sm text-[var(--mudo)]">Sem dados ainda</div>}
        </div>
      )}
    </div>
  );
}
