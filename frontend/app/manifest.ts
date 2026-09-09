import type { MetadataRoute } from "next";

// Servi sur /manifest.webmanifest et référencé automatiquement dans <head> par Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SillyGames",
    short_name: "SillyGames",
    description: "Bâtonnets et pierre-feuille-ciseaux contre une IA.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#c2410c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
