"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Mapa, { type Pintar } from "@/components/Mapa";
import Placar from "@/components/Placar";
import Totais from "@/components/Totais";
import { AvisoPausa, LinhaStatus, PorRegiao, Vantagem } from "@/components/Disputa";
import LinhaDoTempo from "@/components/LinhaDoTempo";
import { reconstruir, type Foto } from "@/lib/linhaTempo";
import BarraDupla from "@/components/BarraDupla";
import Corrida, { type Ponto } from "@/components/Corrida";
import { Aviso, Rodape, Topo, comTurno, useAoVivo, useTurno } from "@/components/aoVivo";
import { CORES, HEX, NOMES_UF, fmt, fmtPct, sigla } from "@/components/fmt";
import type { Resumo } from "@/lib/tse";
import { brasil } from "@/lib/fonte";

export default function Home() {
  const turno = useTurno();
  const { dados: aoVivo, erro } = useAoVivo<Awaited<ReturnType<typeof brasil>>>(turno ? `br-${turno}` : null, () => brasil(turno!), 5000);
  // linha do tempo: null = ao vivo; uma foto = mostra como estava naquele horario
  const [momento, setMomento] = useState<Foto | null>(null);
  const dados = useMemo(() => (aoVivo && momento ? { ...aoVivo, ...reconstruir(momento, aoVivo), peloBU: false } : aoVivo), [aoVivo, momento]);
  const [sel, setSel] = useState("br");
  // "Ver o meu estado": a escolha fica salva neste navegador
  useEffect(() => {
    try { const m = localStorage.getItem("meuEstado"); if (m) setSel(m); } catch {}
  }, []);
  const escolher = (uf: string) => {
    setSel(uf);
    try { localStorage.setItem("meuEstado", uf); } catch {}
  };
  const [modo, setModo] = useState<"geo" | "blocos">("geo");
  const [pintar, setPintar] = useState<Pintar>("margem");
  const [ordem, setOrdem] = useState<"eleitorado" | "margem" | "nome">("eleitorado");
  const [historico, setHistorico] = useState<Ponto[]>([]);

  // curva da corrida: um ponto a cada nova parcial
  useEffect(() => {
    const br = aoVivo?.br;
    if (!br?.cand[0] || br.pst === 0) return;
    setHistorico((h) => {
      const base = h.length && br.pst < h[h.length - 1].pst ? [] : h;
      if (base.length && base[base.length - 1].pst === br.pst) return base;
      return [...base, { pst: br.pst, a: br.cand[0].pvap }];
    });
  }, [aoVivo]);

  const br = dados?.br ?? null;
  const atual: Resumo | null = sel === "br" ? br : dados?.ufs[sel] ?? null;
  const nomes = br?.cand.map((c) => c.nm) ?? [];
  const href = (uf: string) => comTurno(`/uf?uf=${uf}`, turno);

  const estados = useMemo(() => {
    const margem = (r: Resumo) => Math.abs((r.cand[0]?.pvap ?? 0) - (r.cand[1]?.pvap ?? 0));
    return Object.values(dados?.ufs ?? {}).sort((x, y) =>
      ordem === "nome" ? NOMES_UF[x.uf].localeCompare(NOMES_UF[y.uf]) : ordem === "margem" ? margem(x) - margem(y) : y.eleitorado - x.eleitorado,
    );
  }, [dados, ordem]);

  const vencidos = useMemo(() => {
    const cont = [0, 0];
    for (const r of Object.values(dados?.ufs ?? {})) {
      const [a, b] = r.cand;
      if (a && b && a.vap + b.vap > 0) cont[a.vap >= b.vap ? 0 : 1]++;
    }
    return cont;
  }, [dados]);

  const lider = br && br.cand.length === 2 && br.cand[0].vap !== br.cand[1].vap ? (br.cand[0].vap > br.cand[1].vap ? 0 : 1) : -1;
  const dif = br && br.cand.length === 2 ? Math.abs(br.cand[0].vap - br.cand[1].vap) : 0;

  return (
    <div className="min-h-screen">
      <Topo erro={erro} consultadoEm={dados?.consultadoEm} turno={turno} />
      {br && br.pst > 0 && <Ticker ufs={dados!.ufs} turno={turno} />}

      <main className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <header className="mt-6 grid items-stretch gap-0 lg:grid-cols-[1fr_auto]">
          <div className="painel border-l-8 !border-l-[var(--urgente)] px-5 py-4">
            <div className="rotulo mb-1">Eleições 2026 · Presidente da República · {turno === 1 ? "1º" : "2º"} turno</div>
            <h1 className="break-words font-serif text-3xl font-extrabold leading-[.95] sm:text-6xl">
              {br && lider >= 0 ? (
                br.cand[lider].eleito ? <>{br.cand[lider].nm} <span className="text-[#16c172]">é eleito</span></> : <>{br.cand[lider].nm} <span className="text-[var(--mudo)]">{turno === 1 ? "liderou o 1º turno" : "lidera a apuração"}</span></>
              ) : (
                <>Apuração <span className="text-[var(--mudo)]">urna por urna</span></>
              )}
            </h1>
          </div>
          {br && (
            <div className="flex flex-col justify-center bg-white px-6 py-4 text-black lg:min-w-72 lg:text-right">
              <div className="font-serif text-sm font-bold uppercase tracking-widest text-neutral-500">Seções apuradas</div>
              <div className="font-serif text-5xl font-extrabold leading-none sm:text-7xl">{fmtPct(br.pst)}</div>
              <div className="mt-2 h-2 w-full bg-neutral-200">
                <div className="h-full bg-[var(--urgente)] transition-[width] duration-700" style={{ width: `${br.pst}%` }} />
              </div>
            </div>
          )}
        </header>

        {turno === 2 && <AvisoPausa />}
        {turno === 2 && aoVivo?.br && <LinhaDoTempo cand={aoVivo.br.cand} onMomento={setMomento} />}
        {erro && !dados && <Aviso>Falha ao consultar o TSE ({erro}). Nova tentativa em instantes.</Aviso>}
        {dados?.aguardando && (
          <Aviso>
            O TSE ainda não divulgou a primeira parcial deste turno. A página se atualiza sozinha.{" "}
            {turno !== 1 && <Link href="?turno=1" className="font-bold underline">Explorar o 1º turno com dados reais →</Link>}
          </Aviso>
        )}
        {!dados && !erro && <div className="py-24 font-serif text-3xl italic text-[var(--mudo)]">Carregando parciais…</div>}

        {br && (
          <>
            <section className="painel mt-4 p-4 sm:p-8">
              <div className="rotulo mb-1">Brasil · Presidente · 2026 · {turno === 1 ? "1º" : "2º"} turno</div>
              <div className="mb-5">
                <LinhaStatus r={br} aoVivo={turno === 2} fonte={dados!.peloBU ? `soma de ${fmt(dados!.urnasLidas)} urnas já lidas` : undefined} />
              </div>
              <Placar r={br} />
              <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <Vantagem r={br} />
                <span className="font-serif text-sm font-bold uppercase text-[var(--mudo)]">
                  Estados: <b style={{ color: CORES[0] }}>{vencidos[0]}</b> × <b style={{ color: CORES[1] }}>{vencidos[1]}</b>
                </span>
              </div>
              <div className="mt-6"><Totais r={br} colunas={6} /></div>
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <section className="painel p-3 sm:p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="rotulo">Mapa</div>
                    <h2 className="font-serif text-3xl">Quem lidera em cada estado</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  <div className="flex border border-[var(--linha)] font-mono text-[11px] uppercase tracking-widest">
                    <span className="flex items-center px-2 text-[var(--mudo)]">Pintar por</span>
                    {(["margem", "vencedor"] as const).map((m) => (
                      <button key={m} onClick={() => setPintar(m)}
                        className={`px-3 py-1.5 transition ${pintar === m ? "bg-[var(--tinta)] text-[var(--papel)]" : "hover:bg-[var(--papel-2)]"}`}>
                        {m === "margem" ? "Margem" : "Vencedor"}
                      </button>
                    ))}
                  </div>
                  <div className="flex border border-[var(--linha)] font-mono text-[11px] uppercase tracking-widest">
                    {(["geo", "blocos"] as const).map((m) => (
                      <button key={m} onClick={() => setModo(m)}
                        className={`px-3 py-1.5 transition ${modo === m ? "bg-[var(--tinta)] text-[var(--papel)]" : "hover:bg-[var(--papel-2)]"}`}>
                        {m === "geo" ? "Geográfico" : "Blocos"}
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
                <Mapa ufs={dados!.ufs} selecionada={sel} onSelecionar={escolher} modo={modo} pintar={pintar} />
                <Legenda nomes={nomes} />
                {dados!.ufsPeloBU.length > 0 && (
                  <p className="mt-2 font-serif text-xs font-bold uppercase text-[#f5c518]">
                    {dados!.ufsPeloBU.length} {dados!.ufsPeloBU.length === 1 ? "estado mostra" : "estados mostram"} a soma de {fmt(dados!.urnasLidas)} urnas já lidas (o TSE ainda não atualizou o total oficial deles)
                  </p>
                )}
              </section>

              <aside className="flex flex-col gap-4">
                <section className="painel p-5">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="rotulo">Recorte</div>
                      <h2 className="font-serif text-3xl leading-none">{NOMES_UF[sel]}</h2>
                    </div>
                    <select value={sel} onChange={(e) => escolher(e.target.value)} aria-label="Ver o meu estado"
                      className="border border-[var(--linha)] bg-[var(--papel-2)] px-2 py-1.5 font-mono text-sm uppercase">
                      <option value="br">Brasil</option>
                      {Object.keys(dados!.ufs).sort().map((uf) => <option key={uf} value={uf}>{NOMES_UF[uf]}</option>)}
                    </select>
                  </div>
                  {atual ? (
                    <>
                      <div className="mt-5"><Placar r={atual} compacto /></div>
                      <div className="mt-6"><Totais r={atual} /></div>
                      {sel !== "br" && (
                        <Link href={href(sel)} className="mt-5 flex items-center justify-between border border-[var(--linha)] px-4 py-3 font-mono text-xs uppercase tracking-widest transition hover:bg-[var(--tinta)] hover:text-[var(--papel)]">
                          Municípios, escolas e seções <span>→</span>
                        </Link>
                      )}
                    </>
                  ) : <p className="mt-4 font-serif text-lg italic text-[var(--mudo)]">Sem dados para este estado ainda.</p>}
                </section>

                <section className="painel p-5">
                  <PorRegiao ufs={dados!.ufs} />
                </section>

                <section className="painel p-5">
                  <div className="rotulo">A corrida</div>
                  <h2 className="mb-4 font-serif text-3xl">Como a vantagem evoluiu</h2>
                  <Corrida pontos={historico} nomes={nomes} />
                </section>
              </aside>
            </div>

            <section className="painel mt-4 p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="rotulo">Estado a estado</div>
                  <h2 className="font-serif text-3xl">Os 27 estados e o Exterior</h2>
                </div>
                <div className="flex gap-4 font-mono text-[11px] uppercase tracking-widest">
                  {(["eleitorado", "margem", "nome"] as const).map((o) => (
                    <button key={o} onClick={() => setOrdem(o)}
                      className={`border-b-2 pb-0.5 ${ordem === o ? "border-[var(--linha)]" : "border-transparent text-[var(--mudo)] hover:text-[var(--tinta)]"}`}>
                      {o === "eleitorado" ? "Maiores" : o === "margem" ? "Mais disputados" : "A–Z"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 sm:gap-x-8 xl:grid-cols-3">
                {estados.map((r) => <LinhaEstado key={r.uf} r={r} href={href(r.uf)} />)}
              </div>
            </section>
          </>
        )}

        <Rodape />
      </main>
    </div>
  );
}

function Ticker({ ufs, turno }: { ufs: Record<string, Resumo>; turno: number | null }) {
  const itens = Object.values(ufs).sort((a, b) => a.uf.localeCompare(b.uf));
  const bloco = (k: string) => itens.map((r) => {
    const [a, b] = r.cand;
    const l = a && b && a.vap + b.vap > 0 ? (a.vap >= b.vap ? 0 : 1) : -1;
    return (
      <Link key={k + r.uf} href={comTurno(`/uf?uf=${r.uf}`, turno)} className="flex shrink-0 items-center gap-2 px-5 hover:underline">
        <b>{sigla(r.uf)}</b>
        {l >= 0 && <i className="inline-block h-2 w-2" style={{ background: HEX[l] }} />}
        {l >= 0 && <span>{fmtPct(r.cand[l].pvap, 1)}</span>}
        <span className="text-[var(--mudo)]">{fmtPct(r.pst, 0)} apur.</span>
      </Link>
    );
  });
  return (
    <div className="overflow-hidden border-b border-[var(--linha)] bg-[var(--papel-2)] py-2 font-mono text-xs">
      <div className="ticker flex w-max">{bloco("a")}{bloco("b")}</div>
    </div>
  );
}

function Legenda({ nomes }: { nomes: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-[var(--mudo)]">
      {nomes.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          <span className="flex">
            {[0.25, 0.5, 0.75, 1].map((o) => <i key={o} className="inline-block h-3 w-4" style={{ background: HEX[i], opacity: o }} />)}
          </span>
          {n}
        </span>
      ))}
      <span>Tom mais forte = vantagem maior</span>
    </div>
  );
}

function LinhaEstado({ r, href }: { r: Resumo; href: string }) {
  const [a, b] = r.cand;
  const tem = a && b && a.vap + b.vap > 0;
  return (
    <Link href={href} className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-[var(--linha)] py-3 transition hover:bg-[var(--papel-2)]">
      <span className="font-mono text-sm font-bold">{sigla(r.uf)}</span>
      <span className="min-w-0">
        <span className="block truncate font-serif text-lg leading-tight">{NOMES_UF[r.uf]}</span>
        <span className="mt-1 block"><BarraDupla r={r} /></span>
      </span>
      <span className="text-right font-mono text-xs leading-tight">
        {tem ? <>
          <span style={{ color: CORES[0] }}>{fmtPct(a.pvap, 1)}</span>
          <span className="text-[var(--mudo)]"> · </span>
          <span style={{ color: CORES[1] }}>{fmtPct(b.pvap, 1)}</span>
        </> : "—"}
        <span className="block text-[var(--mudo)]">{fmtPct(r.pst, 0)} apurado</span>
      </span>
    </Link>
  );
}
