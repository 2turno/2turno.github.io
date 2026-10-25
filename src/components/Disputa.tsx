import type { Resumo } from "@/lib/tse";
import BarraDupla from "./BarraDupla";
import { CORES, REGIOES, fmt, fmtPct, horaTSE } from "./fmt";

/** "Ao vivo · 0,25% das urnas apuradas · Atualizado às 17h06 (horário de Brasília)". */
export function LinhaStatus({ r, fonte, aoVivo = true }: { r: Resumo; fonte?: string; aoVivo?: boolean }) {
  const h = horaTSE(r.atualizado);
  return (
    <div className="flex items-start gap-2 font-serif text-sm font-bold uppercase sm:text-base">
      {aoVivo && <i className="piscar mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--urgente)]" />}
      <span>
        {aoVivo ? "Ao vivo · " : ""}{fmtPct(r.pst)} das urnas apuradas
        {fonte ? <span className="text-[#f5c518]"> · {fonte}</span> : h && r.pst > 0 ? <> · Atualizado às {h} <span className="text-[var(--mudo)]">(horário de Brasília)</span></> : null}
      </span>
    </div>
  );
}

/** "Lula, 15,32 pontos a mais · 51.405 votos de diferença · 335.743 votos válidos". */
export function Vantagem({ r }: { r: Resumo }) {
  const [a, b] = r.cand;
  if (!a || !b) return null;
  const validos = a.vap + b.vap;
  if (!validos) return <p className="font-serif text-sm font-semibold uppercase text-[var(--mudo)]">Aguardando os primeiros votos</p>;
  const i = a.vap >= b.vap ? 0 : 1;
  const lider = r.cand[i];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-sm font-bold uppercase sm:text-base">
      <span className="flex items-center gap-2">
        <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CORES[i] }} />
        {lider.nm}, {Math.abs(a.pvap - b.pvap).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pontos a mais
      </span>
      <span className="text-[var(--mudo)]">{fmt(Math.abs(a.vap - b.vap))} votos de diferença</span>
      <span className="text-[var(--mudo)]">{fmt(validos)} votos válidos · Dados do TSE</span>
    </div>
  );
}

/** Soma os estados de cada regiao (usando o valor mais recente de cada estado). */
function somarRegiao(ufs: Record<string, Resumo>, lista: string[]) {
  const rs = lista.map((u) => ufs[u]).filter(Boolean);
  const va = rs.reduce((s, r) => s + (r.cand[0]?.vap ?? 0), 0);
  const vb = rs.reduce((s, r) => s + (r.cand[1]?.vap ?? 0), 0);
  const el = rs.reduce((s, r) => s + r.eleitorado, 0);
  const pst = el ? rs.reduce((s, r) => s + r.pst * r.eleitorado, 0) / el : 0;
  const t = va + vb;
  return { va, vb, pst, cand: [{ vap: va, pvap: t ? (va / t) * 100 : 0 }, { vap: vb, pvap: t ? (vb / t) * 100 : 0 }] };
}

export function PorRegiao({ ufs }: { ufs: Record<string, Resumo> }) {
  return (
    <div>
      <div className="rotulo mb-1">Por região</div>
      <ul>
        {REGIOES.map((g) => {
          const s = somarRegiao(ufs, g.ufs);
          const tem = s.va + s.vb > 0;
          return (
            <li key={g.nome} className="border-b border-[var(--linha)] py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-lg font-extrabold uppercase leading-none">{g.nome}</span>
                {tem ? (
                  <span className="font-serif text-base font-bold">
                    <span style={{ color: CORES[0] }}>{fmtPct(s.cand[0].pvap)}</span>
                    <span className="text-[var(--mudo)]"> · </span>
                    <span style={{ color: CORES[1] }}>{fmtPct(s.cand[1].pvap)}</span>
                  </span>
                ) : (
                  <span className="font-serif text-sm font-semibold uppercase text-[var(--mudo)]">sem urna ainda</span>
                )}
              </div>
              {tem && (
                <>
                  <div className="font-serif text-xs font-semibold uppercase text-[var(--mudo)]">{fmtPct(s.pst)} das urnas</div>
                  <div className="mt-1.5"><BarraDupla r={s} alta="h-2" /></div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Aviso oficial: o TSE pausou a divulgacao ate o fim da votacao (decisao do STF). */
export function AvisoPausa() {
  const agora = new Date();
  const limite = new Date("2026-10-25T19:00:00-03:00");
  if (agora >= limite || agora < new Date("2026-10-25T00:00:00-03:00")) return null;
  return (
    <div className="painel mt-4 border-l-8 !border-l-[#f5c518] px-4 py-3 font-serif text-sm font-bold uppercase leading-snug sm:text-base">
      <span className="text-[#f5c518]">Totalização pausada · </span>
      Por decisão do STF, as seções ficam abertas até as 19h (horário de Brasília). O TSE suspendeu a divulgação e retoma depois desse horário.
      <span className="text-[var(--mudo)]"> Esta página se atualiza sozinha.</span>
    </div>
  );
}

/** Cartoes grandes por regiao: %, votos, lider, diferenca, urnas e estados vencidos. */
export function Regioes({ ufs, cand }: { ufs: Record<string, Resumo>; cand: Resumo["cand"] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {REGIOES.map((g) => {
        const s = somarRegiao(ufs, g.ufs);
        const tem = s.va + s.vb > 0;
        const lider = s.va >= s.vb ? 0 : 1;
        const venc = [0, 0];
        for (const u of g.ufs) {
          const r = ufs[u];
          const a = r?.cand[0]?.vap ?? 0, b = r?.cand[1]?.vap ?? 0;
          if (a + b > 0) venc[a >= b ? 0 : 1]++;
        }
        return (
          <div key={g.nome} className="painel p-4" style={tem ? { borderTop: `4px solid ${CORES[lider]}` } : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-serif text-2xl font-extrabold uppercase leading-none">{g.nome}</span>
              <span className="font-serif text-xs font-bold uppercase text-[var(--mudo)]">{tem ? `${fmtPct(s.pst)} das urnas` : "sem urna ainda"}</span>
            </div>
            {tem ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <div key={i} className={i ? "text-right" : ""}>
                      <div className="truncate font-serif text-sm font-bold uppercase" style={{ color: CORES[i] }}>{cand[i]?.nm}</div>
                      <div className={`font-serif font-extrabold leading-none ${i === lider ? "text-4xl" : "text-3xl text-[var(--mudo)]"}`}>{fmtPct(s.cand[i].pvap)}</div>
                      <div className="font-serif text-xs font-semibold text-[var(--mudo)]">{fmt(i ? s.vb : s.va)} votos</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3"><BarraDupla r={s} alta="h-2.5" /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-3 font-serif text-xs font-bold uppercase text-[var(--mudo)]">
                  <span><span style={{ color: CORES[lider] }}>{cand[lider]?.nm}</span> +{fmt(Math.abs(s.va - s.vb))} votos</span>
                  {g.ufs.length > 1 && <span>Estados: <span style={{ color: CORES[0] }}>{venc[0]}</span> × <span style={{ color: CORES[1] }}>{venc[1]}</span></span>}
                </div>
              </>
            ) : (
              <div className="mt-3"><BarraDupla r={s} alta="h-2.5" /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
