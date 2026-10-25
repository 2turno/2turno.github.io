"use client";
import { useRef, useState } from "react";
import mapa from "@/lib/mapa.json";
import type { Resumo } from "@/lib/tse";
import { HEX, NOMES_UF, fmtPct, sigla } from "./fmt";

export type Pintar = "margem" | "vencedor";
type Props = { ufs: Record<string, Resumo>; selecionada: string; onSelecionar: (uf: string) => void; modo: "geo" | "blocos"; pintar?: Pintar };

// mapa em blocos: cada estado ocupa o mesmo espaco (coluna, linha)
const BLOCOS: Record<string, [number, number]> = {
  rr: [1, 0], ap: [3, 0],
  am: [1, 1], pa: [2, 1], ma: [3, 1], ce: [4, 1], rn: [5, 1],
  ac: [0, 2], ro: [1, 2], to: [2, 2], pi: [3, 2], pe: [4, 2], pb: [5, 2],
  mt: [1, 3], go: [2, 3], ba: [3, 3], se: [4, 3], al: [5, 3],
  ms: [1, 4], df: [2, 4], mg: [3, 4], es: [4, 4],
  pr: [1, 5], sp: [2, 5], rj: [3, 5],
  sc: [1, 6],
  rs: [1, 7], zz: [4, 7],
};

/** Cor do lider: por margem (mais forte = vantagem maior) ou so pelo vencedor (cor cheia). */
function cor(r: Resumo | undefined, pintar: Pintar = "margem") {
  if (!r || r.cand.length < 2 || r.cand[0].vap + r.cand[1].vap === 0) return { fill: "url(#semUrna)", op: 1, lider: -1, pct: 0 };
  const [a, b] = r.cand;
  const margem = Math.abs(a.pvap - b.pvap);
  const lider = a.vap >= b.vap ? 0 : 1;
  return { fill: HEX[lider], op: pintar === "vencedor" ? 0.9 : 0.22 + Math.min(margem / 20, 1) * 0.78, lider, pct: r.cand[lider].pvap };
}

// estados pequenos ganham uma etiqueta ao lado do mapa, ligada por uma linha
const CHAMADAS: Record<string, number> = { rn: 190, pb: 226, pe: 262, al: 298, se: 334, es: 480, rj: 535 };
const X_CHAMADA = 760;

/** Etiqueta "PA 65%": cinza sem urna, na cor do lider quando ja ha votos. */
function Etiqueta({ x, y, uf, r, pintar, onClick, alinhar = "meio" }: { x: number; y: number; uf: string; r?: Resumo; pintar: Pintar; onClick?: () => void; alinhar?: "meio" | "inicio" }) {
  const c = cor(r, pintar);
  const txt = c.lider >= 0 ? `${sigla(uf)} ${Math.round(c.pct)}%` : sigla(uf);
  const w = txt.length * 11.5 + 16, h = 30;
  const x0 = alinhar === "meio" ? x - w / 2 : x;
  return (
    <g onClick={onClick} className={onClick ? "cursor-pointer" : undefined} pointerEvents={onClick ? undefined : "none"}>
      <rect x={x0} y={y - h / 2} width={w} height={h} rx={5} fill={c.lider >= 0 ? HEX[c.lider] : "#3a4150"} stroke="#0006" />
      <text x={x0 + w / 2} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="var(--fonte-tv)" fontSize={20} fontWeight={700} fill="#fff">{txt}</text>
    </g>
  );
}

export default function Mapa({ ufs, selecionada, onSelecionar, modo, pintar = "margem" }: Props) {
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
        <svg viewBox={`0 0 860 ${mapa.h}`} className="mx-auto h-auto max-h-[78vh] w-full" role="img" aria-label="Mapa do Brasil por estado">
          <defs>
            <pattern id="semUrna" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#1a2440" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="#5b6a90" strokeWidth="2" />
            </pattern>
          </defs>
          {mapa.estados.map((e) => {
            const c = cor(ufs[e.uf], pintar);
            return (
              <path key={e.uf} d={e.d} className="estado" fill={c.fill} fillOpacity={c.op}
                stroke="var(--papel)" strokeWidth={1.2} onClick={clicar(e.uf)} onMouseMove={mover(e.uf)} />
            );
          })}
          {/* contorno do selecionado por cima de todos */}
          {mapa.estados.filter((e) => e.uf === selecionada || e.uf === hover?.uf).map((e) => (
            <path key={"s" + e.uf} d={e.d} fill="none" stroke="var(--tinta)" strokeWidth={e.uf === selecionada ? 3 : 1.5} pointerEvents="none" />
          ))}
          {mapa.estados.map((e) => {
            const yCh = CHAMADAS[e.uf];
            if (yCh === undefined)
              return <Etiqueta key={e.uf} x={e.cx} y={e.cy} uf={e.uf} r={ufs[e.uf]} pintar={pintar} />;
            return (
              <g key={e.uf}>
                <path d={`M${e.cx},${e.cy}L${X_CHAMADA - 14},${yCh}`} stroke="#ffffff70" strokeWidth={1} fill="none" pointerEvents="none" />
                <circle cx={e.cx} cy={e.cy} r={2.5} fill="#fff" pointerEvents="none" />
                <Etiqueta x={X_CHAMADA - 12} y={yCh} uf={e.uf} r={ufs[e.uf]} pintar={pintar} alinhar="inicio" onClick={clicar(e.uf)} />
              </g>
            );
          })}
          {/* Exterior: nao tem lugar no mapa, vira uma caixa */}
          <Etiqueta x={700} y={720} uf="zz" r={ufs.zz} pintar={pintar} alinhar="inicio" onClick={clicar("zz")} />
          <text x={700} y={698} fontFamily="var(--fonte-tv)" fontSize={16} fontWeight={700} fill="var(--mudo)" pointerEvents="none">EXTERIOR</text>
        </svg>
      ) : (
        <svg viewBox="0 0 600 690" className="mx-auto h-auto max-h-[78vh] w-full" role="img" aria-label="Mapa em blocos por estado">
          {Object.entries(BLOCOS).map(([uf, [col, lin]]) => {
            const r = ufs[uf];
            const c = cor(r, pintar);
            const x = col * 98 + 10, y = lin * 84 + 10;
            const fundo = c.lider < 0 ? "var(--vazio)" : c.fill;
            const sel = selecionada === uf;
            const claro = c.op > 0.6;
            return (
              <g key={uf} onClick={clicar(uf)} onMouseMove={mover(uf)} className="cursor-pointer">
                <rect x={x} y={y} width={92} height={78} className="estado" fill={fundo} fillOpacity={c.op}
                  stroke="var(--tinta)" strokeWidth={sel ? 3 : 0} />
                <text x={x + 8} y={y + 22} fontFamily="var(--fonte-mono)" fontSize={15} fontWeight={700}
                  fill={claro ? "#fff" : "var(--tinta)"}>{sigla(uf)}</text>
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
