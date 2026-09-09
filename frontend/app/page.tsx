"use client";

import Link from "next/link";

import { displayName, useSession } from "@/lib/session";

export default function HomePage() {
  const { player, loading } = useSession();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold">Deux petits jeux contre une IA</h1>
        <p className="text-muted mt-2">
          Chaque partie est enregistrée. Bientôt, l&apos;IA apprendra de vos coups.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/sticks"
          className="border-border bg-surface hover:border-accent rounded-lg border p-6"
        >
          <h2 className="text-xl font-semibold">Bâtonnets</h2>
          <p className="text-muted mt-1 text-sm">
            Retirez 1 à 3 bâtonnets à tour de rôle. Celui qui prend le dernier a perdu.
          </p>
        </Link>
        <Link
          href="/rps"
          className="border-border bg-surface hover:border-accent rounded-lg border p-6"
        >
          <h2 className="text-xl font-semibold">Pierre-feuille-ciseaux</h2>
          <p className="text-muted mt-1 text-sm">
            Cinq manches. L&apos;IA joue au hasard, pour l&apos;instant.
          </p>
        </Link>
      </section>

      {!loading && player !== null && player.is_guest && (
        <section className="border-border bg-surface rounded-lg border p-4 text-sm">
          Vous jouez en tant que <strong>{displayName(player)}</strong>.{" "}
          <Link href="/register" className="underline">
            Créez un compte
          </Link>{" "}
          pour retrouver vos statistiques depuis un autre navigateur. Vos parties actuelles seront
          conservées.
        </section>
      )}
    </div>
  );
}
