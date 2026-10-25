"use client";
import type { Escola } from "@/lib/secoes";
import { HEX } from "./fmt";

type Props = { escolas: Escola[]; numeros: string[]; aberta: string | null; onAbrir: (id: string) => void };

/** Pontos dos locais de votacao (lat/lon do TSE), coloridos por quem lidera em cada um. */
export default function MapaEscolas({ escolas, numeros, aberta, onAbrir }: Props) {
  const pts = escolas.filter((e) => e.lat && e.lon && Math.abs(e.lat) > 0.01);
  if (pts.length < 2) return <p className="font-serif text-lg italic text-[var(--mudo)]">Sem coordenadas suficientes para desenhar o mapa.</p>;

  // descarta coordenadas muito fora (erros de cadastro) usando a mediana
  const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const mlat = med(pts.map((p) => p.lat!)), mlon = med(pts.map((p) => p.lon!));
  const ok = pts.filter((p) => Math.abs(p.lat! - mlat) < 1.5 && Math.abs(p.lon! - mlon) < 1.5);

  const lats = ok.map((p) => p.lat!), lons = ok.map((p) => p.lon!);
  const [y0, y1, x0, x1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const kx = Math.cos((mlat * Math.PI) / 180); // corrige a distorcao leste-oeste
  const w = Math.max((x1 - x0) * kx, 1e-4), h = Math.max(y1 - y0, 1e-4);
  const W = 500, H = Math.min(700, Math.max(300, (W * h) / w)), P = 18;
  const esc = Math.min((W - 2 * P) / w, (H - 2 * P) / h);
  const ox = (W - w * esc) / 2, oy = (H - h * esc) / 2;
  const maxEl = Math.max(...ok.map((e) => e.el || e.aptos), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-[70vh] w-full bg-[var(--papel-2)]">
      {[...ok].sort((a, b) => (b.el || b.aptos) - (a.el || a.aptos)).map((e) => {
        const cx = ox + (e.lon! - x0) * kx * esc, cy = oy + (y1 - e.lat!) * esc;
        const r = 3 + Math.sqrt((e.el || e.aptos) / maxEl) * 13;
        const va = e.votos[numeros[0]] ?? 0, vb = e.votos[numeros[1]] ?? 0;
        const tot = va + vb;
        const cor = tot ? HEX[va >= vb ? 0 : 1] : "#a8a293";
        const op = tot ? 0.35 + Math.min(Math.abs(va - vb) / tot / 0.4, 1) * 0.6 : 0.5;
        const sel = aberta === e.id;
        return (
          <circle key={e.id} cx={cx} cy={cy} r={r} fill={cor} fillOpacity={op}
            stroke={sel ? "var(--tinta)" : "var(--papel)"} strokeWidth={sel ? 2.5 : 0.75} className="estado"
            onClick={() => {
              onAbrir(e.id);
              document.getElementById(`escola-${e.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
            <title>{e.nm}{tot ? ` — ${Math.round((va / tot) * 100)}% × ${Math.round((vb / tot) * 100)}%` : ""}</title>
          </circle>
        );
      })}
    </svg>
  );
}
