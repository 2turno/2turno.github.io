"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Placar from "@/components/Placar";
import Totais from "@/components/Totais";
import BarraDupla from "@/components/BarraDupla";
import { Aviso, Migalhas, Rodape, Topo, comTurno, useAoVivo, useParametros, useTurno } from "@/components/aoVivo";
import { apuracao, municipiosUf } from "@/lib/cliente";
import { CORES, NOMES_UF, fmt, fmtPct } from "@/components/fmt";
import type { Apuracao, Resumo } from "@/lib/tse";

type Ordem = "eleitorado" | "margem" | "a" | "b" | "abst" | "nome";

export default function PaginaUf() {
  const params = useParametros();
  const uf = params?.get("uf") ?? "";
  const turno = useTurno();
  const pronto = turno && uf ? `${turno}-${uf}` : null;
  const geral = useAoVivo<Apuracao>(pronto, () => apuracao(turno!));
  const muns = useAoVivo<{ municipios: Resumo[]; consultadoEm: string }>(pronto, () => municipiosUf(turno!, uf), 8000);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("eleitorado");

  const resumo = geral.dados?.ufs[uf];
  const nomes = resumo?.cand.map((c) => c.nm) ?? [];

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const sem = (s = "") => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const pa = (r: Resumo) => r.cand[0]?.pvap ?? 0;
    const pb = (r: Resumo) => r.cand[1]?.pvap ?? 0;
    const taxaAbst = (r: Resumo) => r.abstencao / Math.max(1, r.abstencao + r.comparecimento);
    const fn: Record<Ordem, (x: Resumo, y: Resumo) => number> = {
      eleitorado: (x, y) => y.eleitorado - x.eleitorado,
      margem: (x, y) => Math.abs(pa(x) - pb(x)) - Math.abs(pa(y) - pb(y)),
      a: (x, y) => pa(y) - pa(x),
      b: (x, y) => pb(y) - pb(x),
      abst: (x, y) => taxaAbst(y) - taxaAbst(x),
      nome: (x, y) => (x.nome ?? "").localeCompare(y.nome ?? ""),
    };
    return (muns.dados?.municipios ?? []).filter((m) => !q || sem(m.nome).includes(q)).sort(fn[ordem]);
  }, [muns.dados, busca, ordem]);

  const vencidos = useMemo(() => {
    const c = [0, 0];
    for (const m of muns.dados?.municipios ?? []) if (m.cand.length === 2 && m.cand[0].vap + m.cand[1].vap > 0) c[m.cand[0].vap >= m.cand[1].vap ? 0 : 1]++;
    return c;
  }, [muns.dados]);

  return (
    <div className="min-h-screen">
      <Topo erro={geral.erro ?? muns.erro} consultadoEm={muns.dados?.consultadoEm} turno={turno} />
      <main className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <Migalhas itens={[{ href: comTurno("/", turno), txt: "Brasil" }, { txt: NOMES_UF[uf] ?? uf }]} />
        <header className="painel mt-3 border-l-8 !border-l-[var(--urgente)] px-5 py-4">
          <div className="rotulo mb-2">Presidente · {turno === 1 ? "1º" : "2º"} turno · {muns.dados ? `${muns.dados.municipios.length} municípios` : "…"}</div>
          <h1 className="font-serif text-5xl leading-[.9] tracking-tight sm:text-7xl">{NOMES_UF[uf]}</h1>
        </header>

        {(geral.erro || muns.erro) && <Aviso>Falha ao consultar o TSE ({geral.erro ?? muns.erro}). Tentando de novo…</Aviso>}

        {resumo && (
          <section className="painel mt-4 p-5 sm:p-8">
            <Placar r={resumo} />
            <div className="mt-9 flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-xs text-[var(--mudo)] sm:text-sm">
              <span>Diferença: <b className="text-[var(--tinta)]">{fmt(Math.abs((resumo.cand[0]?.vap ?? 0) - (resumo.cand[1]?.vap ?? 0)))}</b> votos</span>
              <span>Municípios: <b style={{ color: CORES[0] }}>{vencidos[0]}</b> × <b style={{ color: CORES[1] }}>{vencidos[1]}</b></span>
              <span>Divulgação TSE: {resumo.atualizado}</span>
            </div>
            <div className="mt-6"><Totais r={resumo} colunas={6} /></div>
          </section>
        )}

        <section className="py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="rotulo">Município a município</div>
              <h2 className="font-serif text-3xl">Toque em uma cidade para ver escolas e seções</h2>
            </div>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar município…"
              className="w-full border-b-2 border-[var(--linha)] bg-transparent py-1.5 font-serif text-xl outline-none placeholder:text-[var(--mudo)] sm:w-72" />
          </div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-widest">
            {([["eleitorado", "Maiores"], ["margem", "Mais disputados"], ["a", nomes[0] ?? "A"], ["b", nomes[1] ?? "B"], ["abst", "Abstenção"], ["nome", "A–Z"]] as [Ordem, string][]).map(([o, t]) => (
              <button key={o} onClick={() => setOrdem(o)}
                className={`border-b-2 pb-0.5 ${ordem === o ? "border-[var(--linha)]" : "border-transparent text-[var(--mudo)] hover:text-[var(--tinta)]"}`}>{t}</button>
            ))}
          </div>

          {!muns.dados && !muns.erro && <p className="py-12 font-serif text-2xl italic text-[var(--mudo)]">Carregando municípios…</p>}

          {/* cabecalho da tabela (telas largas) */}
          {muns.dados && (
            <div className="rotulo hidden grid-cols-[minmax(0,2fr)_minmax(0,2fr)_repeat(5,minmax(0,1fr))] gap-4 border-b-2 border-[var(--linha)] pb-2 lg:grid">
              <span>Município</span><span>{nomes[0]} × {nomes[1]}</span>
              <span className="text-right">Apurado</span><span className="text-right">Eleitores</span>
              <span className="text-right">Abstenção</span><span className="text-right">Brancos</span><span className="text-right">Nulos</span>
            </div>
          )}
          <ul>
            {lista.map((m) => <LinhaMunicipio key={m.cd} m={m} href={comTurno(`/municipio?uf=${uf}&mun=${m.cd}`, turno)} />)}
          </ul>
          {muns.dados && !lista.length && <p className="py-8 font-serif text-xl italic text-[var(--mudo)]">Nenhum município encontrado.</p>}
        </section>

        <Rodape />
      </main>
    </div>
  );
}

function LinhaMunicipio({ m, href }: { m: Resumo; href: string }) {
  const [a, b] = m.cand;
  const tem = a && b && a.vap + b.vap > 0;
  const pct = (v: number, base: number) => (base ? fmtPct((v / base) * 100, 1) : "—");
  return (
    <li>
      <Link href={href}
        className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-[var(--linha)] py-3 transition hover:bg-[var(--papel-2)] lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <span className="truncate font-serif text-lg leading-tight">{m.nome}</span>
        <span className="order-3 col-span-2 flex items-center gap-2 font-mono text-xs lg:order-none lg:col-span-1">
          <span className="w-12 text-right" style={{ color: CORES[0] }}>{tem ? fmtPct(a.pvap, 1) : "—"}</span>
          <span className="flex-1"><BarraDupla r={m} /></span>
          <span className="w-12" style={{ color: CORES[1] }}>{tem ? fmtPct(b.pvap, 1) : "—"}</span>
        </span>
        <span className="text-right font-mono text-xs">{fmtPct(m.pst, 0)}</span>
        <span className="hidden text-right font-mono text-xs lg:block">{fmt(m.eleitorado)}</span>
        <span className="hidden text-right font-mono text-xs lg:block">{pct(m.abstencao, m.abstencao + m.comparecimento)}</span>
        <span className="hidden text-right font-mono text-xs lg:block">{pct(m.brancos, m.comparecimento)}</span>
        <span className="hidden text-right font-mono text-xs lg:block">{pct(m.nulos, m.comparecimento)}</span>
      </Link>
    </li>
  );
}
