import { HEX, fmtPct } from "./fmt";

export type Ponto = { pst: number; a: number };

/** Evolucao do % do candidato A conforme as urnas sao apuradas (eixo X = % apurado). */
export default function Corrida({ pontos, nomes }: { pontos: Ponto[]; nomes: string[] }) {
  const W = 400, H = 160, P = 4;
  if (pontos.length < 2)
    return <p className="font-serif text-lg italic text-[var(--mudo)]">A curva aparece conforme novas parciais chegam…</p>;

  const vals = pontos.map((p) => p.a);
  const amp = Math.max(2, ...vals.map((v) => Math.abs(v - 50))) * 1.2;
  const x = (pst: number) => P + (pst / 100) * (W - 2 * P);
  const y = (v: number) => H / 2 - ((v - 50) / amp) * (H / 2 - P);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(p.pst).toFixed(1)},${y(p.a).toFixed(1)}`).join("");
  const ult = pontos[pontos.length - 1];
  const area = `${linha}L${x(ult.pst)},${H / 2}L${x(pontos[0].pst)},${H / 2}Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible">
        <defs>
          <clipPath id="cima"><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
          <clipPath id="baixo"><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
        </defs>
        <path d={area} fill={HEX[0]} fillOpacity={0.18} clipPath="url(#cima)" />
        <path d={area} fill={HEX[1]} fillOpacity={0.18} clipPath="url(#baixo)" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--tinta)" strokeDasharray="2 4" />
        <path d={linha} fill="none" stroke="var(--tinta)" strokeWidth={1.75} strokeLinejoin="round" />
        <circle cx={x(ult.pst)} cy={y(ult.a)} r={4} fill={ult.a >= 50 ? HEX[0] : HEX[1]} stroke="var(--tinta)" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--mudo)]">
        <span>▲ {nomes[0]}</span>
        <span>{fmtPct(ult.pst, 1)} apurado</span>
        <span>{nomes[1]} ▼</span>
      </div>
    </div>
  );
}
