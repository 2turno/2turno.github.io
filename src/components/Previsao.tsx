"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ponto, Previsao as TPrevisao } from "@/lib/previsao";
import type { Candidato } from "@/lib/tse";
import { CORES, HEX, fmtPct } from "./fmt";

type Props = { previsao: TPrevisao | null | undefined; serie: Ponto[]; cand: Candidato[] };
type Aba = "chance" | "votos";

const hora = (t: number, seg = false) =>
  new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(seg ? { second: "2-digit" } : {}) });

/** Curva suave que nao "passa do ponto" (monotona), para a linha nao inventar picos. */
function curva(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  let s = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3;
    s += `C${(x0 + h).toFixed(1)},${(y0 + m[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - m[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return s;
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export default function Previsao({ previsao, serie, cand }: Props) {
  const [aba, setAba] = useState<Aba>("chance");
  const [ref, W] = useLargura<HTMLDivElement>();
  const [mira, setMira] = useState<number | null>(null);
  const [a, b] = cand;

  const H = W < 500 ? 220 : 300;
  const M = { e: 38, d: 14, t: 14, b: 26 };
  const pts = serie.length ? serie : previsao ? [previsao] : [];

  const g = useMemo(() => {
    if (!pts.length) return null;
    const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, t0 + 60_000);
    const x = (t: number) => M.e + ((t - t0) / (t1 - t0)) * (W - M.e - M.d);
    let lo = 0, hi = 100;
    if (aba === "votos") {
      const vals = pts.flatMap((p) => [p.li, p.ls, 100 - p.li, 100 - p.ls]);
      const amp = Math.max(4, ...vals.map((v) => Math.abs(v - 50))) + 1;
      lo = 50 - amp; hi = 50 + amp;
    }
    const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
    const sA = aba === "chance" ? (p: Ponto) => p.probA : (p: Ponto) => p.pA;
    const linhaA = curva(pts.map((p) => [x(p.t), y(sA(p))]));
    const linhaB = curva(pts.map((p) => [x(p.t), y(100 - sA(p))]));
    const faixa = aba === "votos" && pts.length > 1
      ? curva(pts.map((p) => [x(p.t), y(p.ls)])) + "L" + curva([...pts].reverse().map((p) => [x(p.t), y(p.li)])).slice(1) + "Z"
      : "";
    const marcas = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
    const niveis = aba === "chance" ? [0, 25, 50, 75, 100] : [lo, (lo + 50) / 2, 50, (hi + 50) / 2, hi].map((v) => Math.round(v));
    return { x, y, sA, linhaA, linhaB, faixa, marcas, niveis, t0, t1 };
  }, [pts, aba, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a || !b) return null;
  const probA = previsao?.probA ?? 50;
  const lider = probA >= 50 ? 0 : 1;
  const chance = [probA, 100 - probA];
  const sel = mira !== null ? pts[mira] : null;

  const mover = (clientX: number, el: Element) => {
    if (!g || pts.length < 2) return;
    const px = clientX - el.getBoundingClientRect().left;
    let melhor = 0;
    pts.forEach((p, i) => { if (Math.abs(g.x(p.t) - px) < Math.abs(g.x(pts[melhor].t) - px)) melhor = i; });
    setMira(melhor);
  };

  return (
    <section className="painel mt-4 overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="rotulo flex items-center gap-2"><i className="piscar inline-block h-2 w-2 rounded-full bg-[var(--urgente)]" />Previsão ao vivo</div>
          <h2 className="font-serif text-3xl font-extrabold sm:text-4xl">Chance de vitória</h2>
        </div>
        <div className="flex border border-[var(--linha)] font-serif text-xs font-bold uppercase tracking-wider sm:text-sm">
          {(["chance", "votos"] as Aba[]).map((x) => (
            <button key={x} onClick={() => setAba(x)}
              className={`px-3 py-1.5 transition ${aba === x ? "bg-white text-black" : "text-[var(--mudo)] hover:text-white"}`}>
              {x === "chance" ? "Chance" : "Projeção de votos"}
            </button>
          ))}
        </div>
      </div>

      {/* numeros grandes */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {[a, b].map((c, i) => (
          <div key={c.n} className={i ? "text-right" : ""}>
            <div className="font-serif text-lg font-bold uppercase sm:text-2xl" style={{ color: CORES[i] }}>{c.nm}</div>
            <div className={`font-serif font-extrabold leading-none ${i === lider ? "text-[15vw] sm:text-8xl" : "text-[10vw] text-[var(--mudo)] sm:text-6xl"}`}>
              {previsao ? `${Math.round(chance[i])}%` : "—"}
            </div>
            {previsao && (
              <div className="mt-1 font-serif text-sm font-semibold text-[var(--mudo)] sm:text-base">
                projeção {fmtPct(i ? 100 - previsao.pA : previsao.pA, 1)} dos válidos
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-3 flex h-3 overflow-hidden bg-[var(--vazio)]">
        <div className="h-full transition-[width] duration-1000" style={{ width: `${chance[0]}%`, background: CORES[0] }} />
        <div className="h-full flex-1" style={{ background: CORES[1] }} />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" />
      </div>

      {/* grafico */}
      <div ref={ref} className="relative mt-6 select-none" style={{ touchAction: "pan-y" }}>
        {g && pts.length > 1 ? (
          <svg width={W} height={H} className="block"
            onMouseMove={(e) => mover(e.clientX, e.currentTarget)} onMouseLeave={() => setMira(null)}
            onTouchMove={(e) => mover(e.touches[0].clientX, e.currentTarget)} onTouchEnd={() => setMira(null)}>
            <defs>
              {HEX.map((cor, i) => (
                <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={cor} stopOpacity={0} />
                </linearGradient>
              ))}
              <filter id="neon"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {g.niveis.map((v) => (
              <g key={v}>
                <line x1={M.e} x2={W - M.d} y1={g.y(v)} y2={g.y(v)} stroke={v === 50 ? "#ffffff55" : "#ffffff12"} strokeDasharray={v === 50 ? "4 4" : undefined} />
                <text x={M.e - 6} y={g.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--mudo)" fontFamily="var(--fonte-tv)">{v}%</text>
              </g>
            ))}
            {g.marcas.map((t, i) => (
              <text key={i} x={g.x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontSize="11" fill="var(--mudo)" fontFamily="var(--fonte-tv)">{hora(t, g.t1 - g.t0 < 600_000)}</text>
            ))}
            {g.faixa && <path d={g.faixa} fill={HEX[lider]} fillOpacity={0.15} />}
            {[g.linhaA, g.linhaB].map((d, i) => (
              <g key={i}>
                <path d={`${d}L${g.x(pts[pts.length - 1].t)},${H - M.b}L${g.x(pts[0].t)},${H - M.b}Z`} fill={`url(#grad${i})`} />
                <path d={d} fill="none" stroke={HEX[i]} strokeWidth={3} strokeLinecap="round" filter="url(#neon)" pathLength={1}
                  style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: "desenhar 1.4s ease-out" }} />
              </g>
            ))}
            {/* ponto atual piscando */}
            {[0, 1].map((i) => {
              const u = pts[pts.length - 1];
              const v = i ? 100 - g.sA(u) : g.sA(u);
              return (
                <g key={i}>
                  <circle cx={g.x(u.t)} cy={g.y(v)} r={9} fill={HEX[i]} opacity={0.35} className="piscar" />
                  <circle cx={g.x(u.t)} cy={g.y(v)} r={4.5} fill={HEX[i]} stroke="#fff" strokeWidth={1.5} />
                </g>
              );
            })}
            {sel && (
              <g pointerEvents="none">
                <line x1={g.x(sel.t)} x2={g.x(sel.t)} y1={M.t} y2={H - M.b} stroke="#fff" strokeOpacity={0.5} />
                {[0, 1].map((i) => <circle key={i} cx={g.x(sel.t)} cy={g.y(i ? 100 - g.sA(sel) : g.sA(sel))} r={5} fill={HEX[i]} stroke="#fff" strokeWidth={2} />)}
              </g>
            )}
          </svg>
        ) : (
          <p className="py-10 text-center font-serif text-lg font-semibold uppercase text-[var(--mudo)]">
            {previsao ? "O gráfico aparece conforme novas parciais chegam…" : "A previsão começa quando as primeiras urnas forem lidas"}
          </p>
        )}

        {sel && g && (
          <div className="pointer-events-none absolute top-0 rounded-sm border border-[var(--linha)] bg-[#04070f]/95 px-3 py-2 font-serif text-sm shadow-2xl"
            style={{ left: Math.min(Math.max(0, g.x(sel.t) - 80), W - 170) }}>
            <div className="font-bold text-[var(--mudo)]">{hora(sel.t)} · {fmtPct(sel.apurado, 1)} apurado</div>
            {[a, b].map((c, i) => (
              <div key={c.n} className="flex justify-between gap-4 font-bold uppercase" style={{ color: CORES[i] }}>
                <span>{c.nm}</span>
                <span>{aba === "chance" ? `${Math.round(i ? 100 - sel.probA : sel.probA)}%` : fmtPct(i ? 100 - sel.pA : sel.pA, 1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 font-serif text-xs font-semibold uppercase leading-snug text-[var(--mudo)]">
        Modelo estatístico só com dados do 2º turno: projeta as urnas que faltam a partir das já apuradas em cada estado e no país.
        {previsao && <> Faixa de erro da projeção: {fmtPct(previsao.li, 1)} a {fmtPct(previsao.ls, 1)}.</>} Não é resultado oficial.
      </p>
    </section>
  );
}
