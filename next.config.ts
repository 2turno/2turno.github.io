import type { NextConfig } from "next";

// Site estatico para GitHub Pages; o caminho base (/2turno) vem do workflow de deploy.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
