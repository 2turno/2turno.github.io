// Decodificador do Boletim de Urna (BU) do TSE: ASN.1 DER (EntidadeEnvelopeGenerico -> EntidadeBoletimUrna).

type No = { tag: number; kids?: No[]; val?: Uint8Array };

function der(buf: Uint8Array, off = 0, end = buf.length): No[] {
  const out: No[] = [];
  while (off < end) {
    const tag = buf[off++];
    let len = buf[off++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + buf[off++];
    }
    if (off + len > end) throw new Error("DER truncado");
    const val = buf.subarray(off, off + len);
    out.push(tag & 0x20 ? { tag, kids: der(buf, off, off + len) } : { tag, val });
    off += len;
  }
  return out;
}

const int = (n?: No) => (n?.val ? n.val.reduce((a, b) => a * 256 + b, 0) : 0);
const seq = (n?: No) => n?.kids ?? [];

// TipoVoto: nominal(1) branco(2) nulo(3) legenda(4) cargoSemCandidato(5)
export type Secao = {
  mun: string; zona: number; secao: number; local: number;
  aptos: number; comparecimento: number; brancos: number; nulos: number;
  votos: Record<string, number>; // numero do candidato -> votos
};

/** Extrai do BU os votos para Presidente (cargo 1) da eleicao informada. */
export function lerBU(bytes: Uint8Array, eleicao: number): Secao {
  const env = der(bytes)[0];
  const interno = seq(env).find((n) => n.tag === 0x04)!; // conteudo: o BU propriamente dito
  const bu = seq(der(interno.val!)[0]);

  // identificacaoSecao: SEQUENCE { SEQUENCE {municipio, zona}, local, secao }
  const id = bu.find((n) => n.tag === 0x30 && n.kids?.length === 3 && n.kids[0].tag === 0x30 && n.kids[0].kids?.length === 2)!;
  const [mz, local, secao] = seq(id);

  // resultadosVotacaoPorEleicao: SEQUENCE OF { idEleicao, aptos, ..., SEQUENCE OF ResultadoVotacao }
  const porEleicao = bu.filter((n) => n.tag === 0x30).flatMap(seq).filter((n) => n.tag === 0x30 && n.kids?.[0]?.tag === 0x02);
  const el = porEleicao.find((n) => int(n.kids![0]) === eleicao);
  if (!el) throw new Error(`eleicao ${eleicao} ausente no BU`);

  const r: Secao = {
    mun: String(int(seq(mz)[0])).padStart(5, "0"), zona: int(seq(mz)[1]), secao: int(secao), local: int(local),
    aptos: int(el.kids![1]), comparecimento: 0, brancos: 0, nulos: 0, votos: {},
  };

  const resultados = seq(el.kids!.find((n, i) => i > 1 && n.tag === 0x30));
  for (const rv of resultados) {
    const [, comp, totais] = seq(rv);
    for (const tc of seq(totais)) {
      const [codCargo, , votaveis] = seq(tc);
      if (codCargo.tag !== 0x81 || int(codCargo) !== 1) continue; // 1 = Presidente
      r.comparecimento = int(comp);
      for (const v of seq(votaveis)) {
        const campos = seq(v);
        const tipo = int(campos.find((c) => c.tag === 0x81));
        const qtd = int(campos.find((c) => c.tag === 0x82));
        const ident = campos.find((c) => c.tag === 0xa3);
        if (tipo === 1 && ident) r.votos[String(int(seq(ident)[1]))] = qtd;
        else if (tipo === 2) r.brancos += qtd;
        else if (tipo === 3) r.nulos += qtd;
      }
    }
  }
  return r;
}
