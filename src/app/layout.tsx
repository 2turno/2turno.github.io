import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const tv = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--fonte-tv" });
const sans = Inter({ subsets: ["latin"], variable: "--fonte-sans" });

export const metadata: Metadata = {
  title: "Apuração 2º Turno · Ao vivo",
  description: "Apuração do 2º turno em tempo real, urna por urna, com dados oficiais do TSE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${tv.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
