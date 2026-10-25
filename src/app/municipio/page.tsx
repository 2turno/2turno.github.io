"use client";
import { useMemo, useState } from "react";
import Placar from "@/components/Placar";
import Totais from "@/components/Totais";
import BarraDupla from "@/components/BarraDupla";
import MapaEscolas from "@/components/MapaEscolas";
import { Aviso, Migalhas, Rodape, Topo, comTurno, useAoVivo, useParametros, useTurno } from "@/components/aoVivo";
import { municipio } from "@/lib/cliente";
import { CORES, NOMES_UF, fmt, fmtPct } from "@/components/fmt";
import type { Escola } from "@/lib/secoes";
import type { Resumo } from "@/lib/tse";

type Dados = {
  resumo: Resumo; fonte: "urnas" | "oficial"; totalSecoes: number; publicadas: number; lidas: number; coletando: boolean;
  escolas: Escola[]; consultadoEm: string;
};

/** Converte os votos crus de uma escola/secao no formato {cand:[a,b]} usado pelas barras. */
function par(votos: Record<string, number>, numeros: string[]) {
  const [va, vb] = numeros.map((n) => votos[n] ?? 0);
  const validos = Object.values(votos).reduce((s, v) => s + v, 0);
  return { cand: [{ vap: va, pvap: validos ? (va / validos) * 100 : 0 }, { vap: vb, pvap: validos ? (vb / validos) * 100 : 0 }] };
}

export default function PaginaMunicipio() {
  const params = useParametros();
  const uf = params?.get("uf") ?? "";
  const mun = params?.get("mun") ?? "";
  const turno = useTurno();
  const { dados, erro } = useAoVivo<Dados>(turno && uf && mun ? `${turno}-${uf}-${mun}` : null, () => municipio(turno!, uf, mun), 4000);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<"eleitores" | "a" | "b" | "abst" | "nome">("eleitores");

  const numeros = dados?.resumo.cand.map((c) => c.n) ?? [];
  const nomes = dados?.resumo.cand.map((c) => c.nm) ?? [];

  const escolas = useMemo(() => {
    const sem = (s = "") => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const q = sem(busca.trim());
    const p = (e: Escola, i: number) => par(e.votos, numeros).cand[i].pvap;
    const abst = (e: Escola) => (e.aptos ? 1 - e.comparecimento / e.aptos : 0);
    return (dados?.escolas ?? [])
      .filter((e) => !q || sem(e.nm).includes(q) || sem(e.ba).includes(q) || sem(e.end).includes(q))
      .sort((x, y) =>
        Number(y.secoes.length > 0) - Number(x.secoes.length > 0) || (ordem === "nome" ? x.nm.localeCompare(y.nm) : ordem === "a" ? p(y, 0) - p(x, 0) : ordem === "b" ? p(y, 1) - p(x, 1) : ordem === "abst" ? abst(y) - abst(x) : (y.el || y.aptos) - (x.el || x.aptos)),
      );
  }, [dados, busca, ordem, numeros.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = dados?.resumo;

  return (
    <div className="min-h-screen">
      <Topo erro={erro} consultadoEm={dados?.consultadoEm} turno={turno} />
      <main className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <Migalhas itens={[
          { href: comTurno("/", turno), txt: "Brasil" },
          { href: comTurno(`/uf?uf=${uf}`, turno), txt: NOMES_UF[uf] ?? uf },
          { txt: r?.nome ?? mun },
        ]} />
        <header className="grid gap-4 painel mt-3 border-l-8 !border-l-[var(--urgente)] px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="rotulo mb-2">Presidente · {turno === 1 ? "1º" : "2º"} turno · {uf.toUpperCase()}</div>
            <h1 className="break-words font-serif text-4xl capitalize leading-[.9] tracking-tight sm:text-7xl">{r?.nome?.toLowerCase() ?? "…"}</h1>
          </div>
          {dados && (
            <div className="lg:text-right">
              <div className="rotulo">Urnas lidas, boletim a boletim</div>
              <div className="font-mono text-4xl font-semibold tracking-tighter sm:text-5xl">
                {fmt(dados.lidas)}<span className="text-[var(--mudo)]">/{fmt(dados.totalSecoes)}</span>
              </div>
              <div className="relative mt-2 h-1.5 w-full bg-[var(--vazio)] lg:ml-auto lg:w-72">
                <div className="absolute inset-y-0 left-0 bg-[var(--tinta)]/30 transition-[width] duration-700" style={{ width: `${(dados.publicadas / Math.max(1, dados.totalSecoes)) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-[var(--tinta)] transition-[width] duration-700" style={{ width: `${(dados.lidas / Math.max(1, dados.totalSecoes)) * 100}%` }} />
              </div>
              <div className="rotulo mt-1.5">
                {dados.coletando ? <span className="piscar">● baixando boletins</span> : `${fmt(dados.publicadas)} publicadas pelo TSE`}
              </div>
            </div>
          )}
        </header>

        {erro && <Aviso>Falha ao consultar o TSE ({erro}). Tentando de novo…</Aviso>}
        {!dados && !erro && <p className="py-24 font-serif text-3xl italic text-[var(--mudo)]">Carregando boletins de urna…</p>}

        {r && dados && (
          <section className="painel mt-4 p-5 sm:p-8">
            <Placar r={r} />
            <div className="mt-9 flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-xs text-[var(--mudo)] sm:text-sm">
              <span>Diferença: <b className="text-[var(--tinta)]">{fmt(Math.abs((r.cand[0]?.vap ?? 0) - (r.cand[1]?.vap ?? 0)))}</b> votos</span>
              {dados.fonte === "urnas"
                ? <span className="font-bold text-[#f5c518]">Parcial pela soma das urnas já lidas · o total oficial do TSE ainda não foi atualizado</span>
                : <span>Divulgação TSE: {r.atualizado}</span>}
            </div>
            <div className="mt-6"><Totais r={r} colunas={6} /></div>
          </section>
        )}

        {dados && (
          <div className="grid lg:grid-cols-[1fr_1.4fr]">
            <section className="border-b border-[var(--linha)] py-6 lg:sticky lg:top-0 lg:self-start lg:border-b-0 lg:border-r lg:pr-8">
              <div className="rotulo">Mapa</div>
              <h2 className="mb-4 font-serif text-3xl">Locais de votação</h2>
              <MapaEscolas escolas={dados.escolas} numeros={numeros} aberta={aberta} onAbrir={setAberta} />
              <p className="mt-3 font-mono text-[11px] text-[var(--mudo)]">
                Cada ponto é um local de votação, do tamanho do eleitorado. Cinza = nenhuma urna lida ainda.
              </p>
            </section>

            <section className="py-6 lg:pl-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="rotulo">Escola a escola · seção a seção</div>
                  <h2 className="font-serif text-3xl">{fmt(dados.escolas.length)} locais</h2>
                </div>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Escola, bairro, rua…"
                  className="w-full border-b-2 border-[var(--linha)] bg-transparent py-1.5 font-serif text-xl outline-none placeholder:text-[var(--mudo)] sm:w-64" />
              </div>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-widest">
                {([["eleitores", "Maiores"], ["a", nomes[0] ?? "A"], ["b", nomes[1] ?? "B"], ["abst", "Abstenção"], ["nome", "A–Z"]] as const).map(([o, t]) => (
                  <button key={o} onClick={() => setOrdem(o)}
                    className={`border-b-2 pb-0.5 ${ordem === o ? "border-[var(--linha)]" : "border-transparent text-[var(--mudo)] hover:text-[var(--tinta)]"}`}>{t}</button>
                ))}
              </div>
              <ul>
                {escolas.map((e) => (
                  <ItemEscola key={e.id} e={e} numeros={numeros} nomes={nomes} aberta={aberta === e.id} onToggle={() => setAberta(aberta === e.id ? null : e.id)} />
                ))}
              </ul>
            </section>
          </div>
        )}

        <Rodape texto="Boletins de urna decodificados direto dos arquivos do TSE" />
      </main>
    </div>
  );
}

function ItemEscola({ e, numeros, nomes, aberta, onToggle }: { e: Escola; numeros: string[]; nomes: string[]; aberta: boolean; onToggle: () => void }) {
  const p = par(e.votos, numeros);
  const lida = e.secoes.length > 0;
  return (
    <li id={`escola-${e.id}`} className={`border-b border-[var(--linha)] ${aberta ? "bg-[var(--papel-2)]" : ""}`}>
      <button onClick={onToggle} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-1 py-3 text-left transition hover:bg-[var(--papel-2)]">
        <span className="min-w-0">
          <span className="block truncate font-serif text-lg leading-tight">{e.nm}</span>
          <span className="block truncate font-mono text-[11px] text-[var(--mudo)]">{[e.ba, e.end].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right font-mono text-xs leading-tight">
          {lida ? <>
            <span style={{ color: CORES[0] }}>{fmtPct(p.cand[0].pvap, 1)}</span>
            <span className="text-[var(--mudo)]"> · </span>
            <span style={{ color: CORES[1] }}>{fmtPct(p.cand[1].pvap, 1)}</span>
          </> : <span className="text-[var(--mudo)]">aguardando</span>}
          <span className="block text-[var(--mudo)]">{e.secoes.length} seç. · {fmt(e.el || e.aptos)} eleit.</span>
        </span>
        <span className="col-span-2"><BarraDupla r={p} /></span>
      </button>

      {aberta && lida && (
        <div className="overflow-x-auto px-1 pb-4">
          <table className="w-full min-w-[560px] font-mono text-xs">
            <thead className="rotulo !text-[10px]">
              <tr className="border-b border-[var(--linha)]">
                <th className="py-1.5 text-left font-normal">Zona/Seção</th>
                <th className="text-right font-normal" style={{ color: CORES[0] }}>{nomes[0]}</th>
                <th className="text-right font-normal" style={{ color: CORES[1] }}>{nomes[1]}</th>
                <th className="text-right font-normal">Brancos</th>
                <th className="text-right font-normal">Nulos</th>
                <th className="text-right font-normal">Compar.</th>
                <th className="text-right font-normal">Abst.</th>
                <th className="text-right font-normal">Aptos</th>
              </tr>
            </thead>
            <tbody>
              {[...e.secoes].sort((x, y) => x.zona - y.zona || x.secao - y.secao).map((s) => (
                <tr key={`${s.zona}-${s.secao}`} className="border-b border-[var(--linha)]">
                  <td className="py-1.5">{s.zona}/{String(s.secao).padStart(4, "0")}</td>
                  <td className="text-right">{fmt(s.votos[numeros[0]] ?? 0)}</td>
                  <td className="text-right">{fmt(s.votos[numeros[1]] ?? 0)}</td>
                  <td className="text-right">{fmt(s.brancos)}</td>
                  <td className="text-right">{fmt(s.nulos)}</td>
                  <td className="text-right">{fmt(s.comparecimento)}</td>
                  <td className="text-right">{fmt(s.aptos - s.comparecimento)}</td>
                  <td className="text-right">{fmt(s.aptos)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1.5">Total</td>
                <td className="text-right">{fmt(e.votos[numeros[0]] ?? 0)}</td>
                <td className="text-right">{fmt(e.votos[numeros[1]] ?? 0)}</td>
                <td className="text-right">{fmt(e.brancos)}</td>
                <td className="text-right">{fmt(e.nulos)}</td>
                <td className="text-right">{fmt(e.comparecimento)}</td>
                <td className="text-right">{fmt(e.aptos - e.comparecimento)}</td>
                <td className="text-right">{fmt(e.aptos)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
