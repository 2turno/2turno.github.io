"use client";
import { useEffect, useRef, useState } from "react";
import { linhaDoTempo } from "@/lib/fonte";
import type { Foto } from "@/lib/linhaTempo";
import type { Candidato } from "@/lib/tse";
import { fmtPct } from "./fmt";

const VELOCIDADES = [10, 60, 300];
const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Controle de "replay" da noite. `onMomento(null)` = ao vivo; `onMomento(foto)` = mostra aquele horario.
 */
export default function LinhaDoTempo({ cand, onMomento, onFotos }: { cand: Candidato[]; onMomento: (f: Foto | null) => void; onFotos?: (f: Foto[]) => void }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [i, setI] = useState<number | null>(null); // null = agora
  const [tocando, setTocando] = useState(false);
  const [vel, setVel] = useState(60);
  const ultimo = useRef(0);

  // busca so as fotos novas a cada 15 s
  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      try {
        const { fotos: novas } = await linhaDoTempo(ultimo.current);
        if (!vivo || !novas.length) return;
        ultimo.current = novas[novas.length - 1].t;
        setFotos((f) => [...f, ...novas]);
      } catch {}
    };
    buscar();
    const id = setInterval(buscar, 15_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  // play: avanca no tempo da noite `vel` vezes mais rapido
  useEffect(() => {
    if (!tocando || fotos.length < 2) return;
    const id = setInterval(() => {
      setI((atual) => {
        const k = atual ?? 0;
        const alvo = fotos[k].t + 250 * vel;
        let n = k;
        while (n < fotos.length - 1 && fotos[n + 1].t <= alvo) n++;
        if (n === k && k < fotos.length - 1) n = k + 1;
        if (n >= fotos.length - 1) { setTocando(false); return null; }
        return n;
      });
    }, 250);
    return () => clearInterval(id);
  }, [tocando, vel, fotos]);

  useEffect(() => onMomento(i === null ? null : fotos[i] ?? null), [i, fotos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onFotos?.(fotos), [fotos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fotos.length < 2) return null;
  const atual = i === null ? fotos[fotos.length - 1] : fotos[i];
  const [va, vb, pst] = atual.d.br ?? [0, 0, 0];
  const lider = va === vb ? null : va > vb ? cand[0] : cand[1];

  return (
    <section className="painel mt-4 p-4 sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <button onClick={() => { if (i === null) setI(0); setTocando((t) => !t); }}
          aria-label={tocando ? "Pausar" : "Rever a noite"}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black transition hover:scale-105">
          {tocando
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-2xl font-extrabold leading-none">{hhmm(atual.t)}{i === null && <span className="ml-2 align-middle text-sm text-[var(--urgente)]">● AGORA</span>}</div>
          <div className="truncate font-serif text-sm font-semibold uppercase text-[var(--mudo)]">
            Brasil · {fmtPct(pst)} das urnas{lider ? ` · ${lider.nm} à frente` : ""}
          </div>
        </div>
        <button onClick={() => setVel(VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length])}
          className="shrink-0 border border-[var(--linha)] px-3 py-2 font-serif text-base font-bold" aria-label="Velocidade">
          {vel}x
        </button>
      </div>
      <input type="range" min={0} max={fotos.length - 1} value={i ?? fotos.length - 1}
        onChange={(e) => { setTocando(false); const v = Number(e.target.value); setI(v === fotos.length - 1 ? null : v); }}
        className="mt-4 w-full accent-[var(--urgente)]" aria-label="Horário" />
      <div className="mt-2 flex gap-2 font-serif text-sm font-bold uppercase">
        <button onClick={() => { setTocando(false); setI(0); }} className="border border-[var(--linha)] px-3 py-1.5 hover:bg-white/10">{hhmm(fotos[0].t)}</button>
        <button onClick={() => { setTocando(false); setI(null); }} className={`border px-3 py-1.5 ${i === null ? "border-white bg-white text-black" : "border-[var(--linha)] hover:bg-white/10"}`}>Agora</button>
      </div>
    </section>
  );
}
