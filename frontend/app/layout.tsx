import type { Metadata } from "next";

import { Header } from "@/components/Header";
import { SessionProvider } from "@/lib/session";

import "./globals.css";

export const metadata: Metadata = {
  title: "SillyGames",
  description: "Bâtonnets et pierre-feuille-ciseaux contre une IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <SessionProvider>
          <Header />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
          <footer className="text-muted px-4 py-6 text-center text-sm">
            SillyGames, projet d&apos;apprentissage du déploiement conteneurisé.
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
