"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { OAuthButtons } from "@/components/OAuthButtons";
import { api, ApiError, type Identity } from "@/lib/api";
import { displayName, useSession } from "@/lib/session";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  microsoft: "Microsoft",
  facebook: "Facebook",
};

export default function AccountPage() {
  const { player, loading } = useSession();
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return api
      .identities()
      .then(setIdentities)
      .catch(() => setError("Impossible de charger les identités."));
  }, []);

  useEffect(() => {
    if (player === null || player.is_guest) return;
    void load();
  }, [player, load]);

  async function unlink(identity: Identity) {
    setError(null);
    try {
      await api.unlinkIdentity(identity.id);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Impossible de retirer la seule façon de vous connecter à ce compte.");
      } else {
        setError("La suppression a échoué.");
      }
    }
  }

  if (loading || player === null) {
    return <p className="text-muted">Chargement…</p>;
  }

  if (player.is_guest) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Compte</h1>
        <p className="text-muted">
          Vous jouez en invité. Créez un compte ou connectez-vous avec un fournisseur externe pour
          conserver vos parties.
        </p>
        <Link href="/register" className="underline">
          Créer un compte
        </Link>
        <OAuthButtons returnTo="/account" title="Continuer avec" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compte de {displayName(player)}</h1>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Connexions externes</h2>
        {identities === null ? (
          <p className="text-muted">Chargement…</p>
        ) : identities.length === 0 ? (
          <p className="text-muted">Aucun fournisseur externe lié.</p>
        ) : (
          <ul className="space-y-2" aria-label="Identités liées">
            {identities.map((identity) => (
              <li
                key={identity.id}
                className="border-border bg-surface flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>
                  <strong>{PROVIDER_LABELS[identity.provider] ?? identity.provider}</strong>
                  {identity.email && <span className="text-muted"> · {identity.email}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => void unlink(identity)}
                  className="text-sm underline"
                  aria-label={`Délier ${PROVIDER_LABELS[identity.provider] ?? identity.provider}`}
                >
                  Délier
                </button>
              </li>
            ))}
          </ul>
        )}
        <OAuthButtons returnTo="/account" title="Lier un fournisseur" />
      </section>
    </div>
  );
}
