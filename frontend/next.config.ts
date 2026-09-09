import type { NextConfig } from "next";

// En production, Caddy route /api vers le backend : l'application appelle /api en relatif.
// En développement, Next relaie /api vers le backend local (même origine, cookies conservés).
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
