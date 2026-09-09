"use client";

// Enregistre le service worker en production et propose de recharger quand une nouvelle
// version est prête. Les mises à jour d'état ne se font que dans des callbacks d'événements.

import { useEffect, useRef, useState } from "react";

export function registerServiceWorker(
  onUpdate: () => void,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  return navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (worker === null) return;
        worker.addEventListener("statechange", () => {
          // installed + un contrôleur existant = une nouvelle version attend.
          if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate();
        });
      });
      return registration;
    })
    .catch(() => null);
}

export function ServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  // Ne recharger que si l'utilisateur l'a demandé : la première prise de contrôle du service
  // worker déclenche aussi controllerchange, et recharger à ce moment-là (parfois hors ligne)
  // casse la page en cours.
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    void registerServiceWorker(() => setUpdateReady(true));
    const reload = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", reload);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", reload);
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="border-border bg-surface fixed right-4 bottom-4 flex items-center gap-3 rounded-lg border px-4 py-3 shadow"
    >
      <span>Nouvelle version disponible.</span>
      <button
        type="button"
        onClick={() => {
          reloadRequested.current = true;
          void navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration?.waiting) registration.waiting.postMessage("SKIP_WAITING");
            else window.location.reload();
          });
        }}
        className="bg-accent text-accent-foreground rounded-md px-3 py-1 text-sm font-medium"
      >
        Recharger
      </button>
    </div>
  );
}
