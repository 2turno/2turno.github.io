// Gera data/locais/{uf}.json a partir do CSV de locais de votacao do TSE (dados abertos).
// Uso: node scripts/gerar-locais.mjs <pasta-com-os-csv>
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const pasta = process.argv[2] ?? "data/locais";
const saida = "data/locais";

const arquivos = fs.readdirSync(pasta).filter((f) => /_[A-Z]{2}\.csv$/.test(f) && !/_(BRASIL|ZZ)\.csv$/.test(f));
for (const f of arquivos) {
  const uf = f.match(/_([A-Z]{2})\.csv$/)[1].toLowerCase();
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(pasta, f), { encoding: "latin1" }) });
  let cab = null;
  const locais = {};
  for await (const linha of rl) {
    const c = linha.split(";").map((v) => v.replace(/^"|"$/g, ""));
    if (!cab) { cab = Object.fromEntries(c.map((n, i) => [n, i])); continue; }
    const g = (k) => c[cab[k]];
    const chave = `${g("CD_MUNICIPIO")}-${g("NR_ZONA")}-${g("NR_LOCAL_VOTACAO")}`;
    const l = (locais[chave] ??= {
      nm: g("NM_LOCAL_VOTACAO"),
      end: g("DS_ENDERECO"),
      ba: g("NM_BAIRRO"),
      lat: Number(g("NR_LATITUDE").replace(",", ".")) || null,
      lon: Number(g("NR_LONGITUDE").replace(",", ".")) || null,
      el: 0,
    });
    l.el += Number(g("QT_ELEITOR_SECAO")) || 0;
  }
  fs.writeFileSync(path.join(saida, `${uf}.json`), JSON.stringify(locais));
  console.log(uf, Object.keys(locais).length, "locais");
}
