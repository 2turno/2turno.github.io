"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/** Turno escolhido na URL (?turno=1); padrao: 2o turno. */
export function useTurno() {
  const [turno, setTurno] = useState<number | null>(null);
  useEffect(() => {
    setTurno(new URLSearchParams(location.search).get("turno") === "1" ? 1 : 2);
  }, []);
  return turno;
}

export const comTurno = (href: string, turno: number | null) =>
  turno === 1 ? href + (href.includes("?") ? "&" : "?") + "turno=1" : href;

/** Parametros da URL (?uf=sp&mun=71072), lidos no navegador. */
export function useParametros() {
  const [p, setP] = useState<URLSearchParams | null>(null);
  useEffect(() => setP(new URLSearchParams(location.search)), []);
  return p;
}

/** Executa `buscar` a cada `ms` (pausa com a aba oculta e atualiza ao voltar). `chave` nula = ainda nao buscar. */
export function useAoVivo<T>(chave: string | null, buscar: () => Promise<T>, ms = 5000) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fn = useRef(buscar);
  fn.current = buscar;

  const carregar = useCallback(async () => {
    if (!chave || document.hidden) return;
    try {
      setDados(await fn.current());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [chave]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, ms);
    document.addEventListener("visibilitychange", carregar);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", carregar); };
  }, [carregar, ms]);

  return { dados, erro };
}

/** Mesma pagina e parametros, no outro turno. */
function trocarTurno(turno: number | null) {
  if (turno === null || typeof window === "undefined") return "?"; // igual ao HTML estatico ate hidratar
  const q = new URLSearchParams(location.search);
  if (turno === 1) q.delete("turno"); else q.set("turno", "1");
  return "?" + q.toString();
}

/** Faixa preta superior: status ao vivo, turno e hora da ultima consulta. */
export function Topo({ erro, consultadoEm, turno }: { erro: string | null; consultadoEm?: string; turno: number | null }) {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="sticky top-0 z-30 flex items-stretch justify-between border-b border-[var(--linha)] bg-[#04070f]/90 font-serif text-sm font-bold uppercase tracking-wider backdrop-blur sm:text-base">
      <span className="flex items-stretch">
        <span className={`flex items-center gap-2 px-4 text-white ${erro ? "bg-neutral-600" : "bg-[var(--urgente)]"}`}>
          <i className={`inline-block h-2.5 w-2.5 rounded-full bg-white ${erro ? "" : "piscar"}`} />
          {erro ? "Reconectando" : "Ao vivo"}
        </span>
        <span className="flex items-center bg-white px-4 text-black">Apuração {turno === 1 ? "1º" : "2º"} turno</span>
      </span>
      <span className="hidden items-center text-[var(--mudo)] lg:flex">{hoje}</span>
      <span className="flex items-center gap-4 px-4">
        <a href={trocarTurno(turno)} className="text-[var(--mudo)] transition hover:text-white">
          Ver {turno === 1 ? "2º" : "1º"} turno
        </a>
        <span className="tabular-nums">{consultadoEm ? new Date(consultadoEm).toLocaleTimeString("pt-BR") : "--:--:--"}</span>
      </span>
    </div>
  );
}

export function Migalhas({ itens }: { itens: { href?: string; txt: string }[] }) {
  return (
    <nav className="rotulo flex flex-wrap items-center gap-2 pt-6">
      {itens.map((i, k) => (
        <span key={k} className="flex items-center gap-2">
          {k > 0 && <span>/</span>}
          {i.href ? <Link href={i.href} className="underline-offset-4 hover:text-[var(--tinta)] hover:underline">{i.txt}</Link> : <span className="text-[var(--tinta)]">{i.txt}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Dado({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-[var(--linha)] py-2.5 pr-2">
      <dt className="rotulo !text-[10px]">{k}</dt>
      <dd className="font-mono text-sm font-semibold">{v}</dd>
    </div>
  );
}

export function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="my-4 border-l-4 border-[var(--b)] bg-[var(--papel-2)] p-4 font-mono text-xs">{children}</div>;
}

export function Rodape({ texto }: { texto?: string }) {
  return (
    <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-[var(--linha)] py-5 font-mono text-[11px] uppercase tracking-widest text-[var(--mudo)]">
      <span>Fonte: Tribunal Superior Eleitoral · resultados.tse.jus.br</span>
      <span>{texto ?? "Atualização a cada 5 s"}</span>
    </footer>
  );
}
