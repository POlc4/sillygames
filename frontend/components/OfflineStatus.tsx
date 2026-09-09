"use client";

// Indique l'état réseau et le nombre de parties hors ligne en attente ; lance la synchronisation
// au retour du réseau et à l'ouverture. Mises à jour d'état uniquement dans des callbacks.

import { useEffect, useState } from "react";

import { isOnline, pendingCount } from "@/lib/offline";
import { syncOfflineGames } from "@/lib/sync";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setOnline(isOnline());
      setPending(pendingCount());
    };
    const sync = () => {
      void syncOfflineGames().then(refresh);
    };
    const timer = setTimeout(() => {
      refresh();
      sync();
    }, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", refresh);
    window.addEventListener("sillygames:offline-queue", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("sillygames:offline-queue", refresh);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <p
      role="status"
      className="border-border bg-surface mx-auto mt-2 w-full max-w-4xl rounded-md border px-3 py-2 text-sm"
    >
      {online
        ? `${pending} partie${pending > 1 ? "s" : ""} hors ligne en attente de synchronisation.`
        : "Hors ligne : vous jouez contre l'IA locale, vos parties seront synchronisées au retour du réseau."}
      {pending > 0 && (
        <>
          {" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void syncOfflineGames().then(() => {
                setOnline(isOnline());
                setPending(pendingCount());
              });
            }}
          >
            Synchroniser
          </button>
        </>
      )}
    </p>
  );
}

/** À appeler après avoir modifié la file : l'indicateur se met à jour. */
export function notifyQueueChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sillygames:offline-queue"));
}
