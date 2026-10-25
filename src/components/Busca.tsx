"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { listaMunicipios } from "@/lib/tse";
import { NOMES_UF, sigla } from "./fmt";

type Item = { tipo: "uf" | "mun"; uf: string; cd?: string; nm: string };
const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Busca "Cidade ou estado" (atalho Ctrl K / ⌘K). */
export default function Busca({ turno }: { turno: number | null }) {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Item[]>([]);
  const [ativo, setAtivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta(true); }
      if (e.key === "Escape") setAberta(false);
    };
    addEventListener("keydown", tecla);
    return () => removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    setTimeout(() => entrada.current?.focus(), 30);
    if (lista.length) return;
    const ufs: Item[] = Object.entries(NOMES_UF).filter(([u]) => u !== "br").map(([uf, nm]) => ({ tipo: "uf", uf, nm }));
    setLista(ufs);
    listaMunicipios(turno ?? 2).then((ms) => setLista([...ufs, ...ms.map((m) => ({ tipo: "mun" as const, ...m }))])).catch(() => {});
  }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const achados = useMemo(() => {
    const t = sem(q.trim());
    if (!t) return lista.filter((i) => i.tipo === "uf").slice(0, 8);
    const comeca = lista.filter((i) => sem(i.nm).startsWith(t) || i.uf === t);
    const contem = lista.filter((i) => !comeca.includes(i) && sem(i.nm).includes(t));
    return [...comeca, ...contem].slice(0, 12);
  }, [q, lista]);

  const href = (i: Item) => {
    const t = turno === 1 ? "&turno=1" : "";
    return i.tipo === "uf" ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/uf/?uf=${i.uf}${t}` : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/municipio/?uf=${i.uf}&mun=${i.cd}${t}`;
  };

  return (
    <>
      <button onClick={() => setAberta(true)}
        className="flex items-center gap-2 px-3 text-[var(--mudo)] transition hover:text-white sm:px-4" aria-label="Buscar cidade ou estado">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="hidden sm:inline">Cidade ou estado</span>
        <kbd className="hidden rounded border border-[var(--linha)] px-1 text-[10px] lg:inline">Ctrl K</kbd>
      </button>

      {aberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-3 pt-[12vh] normal-case tracking-normal" onClick={() => setAberta(false)}>
          <div className="painel w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <input ref={entrada} value={q} placeholder="Digite uma cidade ou estado…"
              onChange={(e) => { setQ(e.target.value); setAtivo(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter" && achados[ativo]) location.href = href(achados[ativo]);
              }}
              className="w-full border-b border-[var(--linha)] bg-transparent px-4 py-4 font-serif text-xl font-bold uppercase text-white outline-none placeholder:text-[var(--mudo)]" />
            <ul className="max-h-[50vh] overflow-y-auto">
              {achados.map((i, k) => (
                <li key={i.tipo + i.uf + (i.cd ?? "")}>
                  <a href={href(i)} onMouseEnter={() => setAtivo(k)}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 font-serif text-base font-bold uppercase ${k === ativo ? "bg-white/10 text-white" : "text-[var(--tinta)]"}`}>
                    <span className="truncate">{i.nm}</span>
                    <span className="shrink-0 text-xs text-[var(--mudo)]">{i.tipo === "uf" ? "Estado" : sigla(i.uf)}</span>
                  </a>
                </li>
              ))}
              {q && !achados.length && <li className="px-4 py-4 font-serif text-sm font-bold uppercase text-[var(--mudo)]">Nada encontrado</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
