"use client";

// Boutons « Continuer avec … » pour chaque fournisseur activé côté serveur.
// Ce sont des liens : le flux OAuth est une navigation complète, pas un appel fetch.

import { useEffect, useState } from "react";

import { api, oauthStartUrl, type Provider } from "@/lib/api";

type Props = { returnTo?: string; title?: string };

export function OAuthButtons({ returnTo = "/", title = "Ou continuer avec" }: Props) {
  const [providers, setProviders] = useState<Provider[] | null>(null);

  useEffect(() => {
    let active = true;
    api
      .providers()
      .then((list) => {
        if (active) setProviders(list);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (providers === null || providers.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted text-sm">{title}</p>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <a
            key={provider.name}
            href={oauthStartUrl(provider.name, returnTo)}
            className="border-border bg-background hover:border-accent rounded-md border px-3 py-1.5 text-sm"
          >
            {provider.label}
          </a>
        ))}
      </div>
    </div>
  );
}
