"use client";

import Link from "next/link";

import { displayName, useSession } from "@/lib/session";

export function Header() {
  const { player, loading, logout } = useSession();
  const registered = player !== null && !player.is_guest;

  return (
    <header className="border-border bg-surface border-b">
      <nav className="mx-auto flex w-full max-w-4xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          SillyGames
        </Link>
        <Link href="/sticks" className="hover:underline">
          Bâtonnets
        </Link>
        <Link href="/rps" className="hover:underline">
          Pierre-feuille-ciseaux
        </Link>
        <Link href="/stats" className="hover:underline">
          Stats
        </Link>
        <span className="ml-auto flex items-center gap-3 text-sm">
          <span aria-live="polite">{loading ? "…" : displayName(player)}</span>
          {registered ? (
            <>
              <Link href="/account" className="underline">
                Compte
              </Link>
              <button type="button" onClick={() => void logout()} className="underline">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="underline">
                Connexion
              </Link>
              <Link href="/register" className="underline">
                Créer un compte
              </Link>
            </>
          )}
        </span>
      </nav>
    </header>
  );
}
