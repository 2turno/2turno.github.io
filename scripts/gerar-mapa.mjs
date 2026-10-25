// Gera src/lib/mapa.json com os paths SVG (projetados e simplificados) dos 27 estados.
import fs from "node:fs";
import { geoMercator, geoPath } from "d3-geo";

const geo = JSON.parse(fs.readFileSync("data/brasil.json", "utf8"));
const W = 800, H = 800;
const proj = geoMercator().fitSize([W, H], geo);

// descarta pontos a menos de 0.8px do anterior
const simplificar = (anel) => {
  const out = [];
  let ult = null;
  for (const p of anel.map((c) => proj(c))) {
    if (!ult || Math.hypot(p[0] - ult[0], p[1] - ult[1]) > 0.8) { out.push(p); ult = p; }
  }
  return out.length >= 3 ? out : null;
};
const anel2d = (a) => "M" + a.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z";

const estados = geo.features.map((f) => {
  const g = f.geometry;
  const polis = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const d = polis.flatMap((poli) => poli.map(simplificar).filter(Boolean).map(anel2d)).join("");
  const [cx, cy] = geoPath(proj).centroid(f);
  return { uf: f.properties.sigla.toLowerCase(), nome: f.properties.name, d, cx: +cx.toFixed(1), cy: +cy.toFixed(1) };
});
fs.mkdirSync("src/lib", { recursive: true });
fs.writeFileSync("src/lib/mapa.json", JSON.stringify({ w: W, h: H, estados }));
console.log("ok", estados.length, "estados,", fs.statSync("src/lib/mapa.json").size, "bytes");
