"use client";

// Cycle de vie d'une partie côté client : création, coups, erreurs. Aucune règle de jeu ici
// en ligne : le serveur renvoie l'état complet après chaque coup. Hors ligne (réseau absent ou
// serveur injoignable), la partie se joue avec les moteurs locaux et est mise en file pour être
// importée et validée par le serveur au retour du réseau.

import { useCallback, useState } from "react";

import { notifyQueueChanged } from "@/components/OfflineStatus";
import {
  api,
  ApiError,
  type Game,
  type GameType,
  type RpsState,
  type SticksState,
} from "@/lib/api";
import { createLocalGame, isLocalGame, playLocal } from "@/lib/local-game";
import { enqueue, isOnline, toOfflineGame } from "@/lib/offline";

export type GameHook<S> = {
  game: Game<S> | null;
  busy: boolean;
  error: string | null;
  offline: boolean;
  start: (aiStrategy: string, config: Record<string, unknown>) => Promise<void>;
  play: (move: number | string) => Promise<void>;
  reset: () => void;
};

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    return typeof err.detail === "string" ? err.detail : `Erreur ${err.status}`;
  }
  return "Le serveur ne répond pas.";
}

/** Vrai pour une panne réseau ou serveur (pas pour une erreur métier 4xx). */
function isUnreachable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500;
}

export function useGame<S extends SticksState | RpsState>(gameType: GameType): GameHook<S> {
  const [game, setGame] = useState<Game<S> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const run = useCallback(async (action: () => Promise<Game<S>>, fallback?: () => Game<S>) => {
    setBusy(true);
    setError(null);
    try {
      setGame(await action());
      setOffline(false);
    } catch (err) {
      if (fallback && isUnreachable(err)) {
        setGame(fallback());
        setOffline(true);
      } else {
        setError(describe(err));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    (aiStrategy: string, config: Record<string, unknown>) => {
      const local = () => createLocalGame<S>(gameType, aiStrategy, config);
      if (!isOnline()) {
        setGame(local());
        setOffline(true);
        setError(null);
        return Promise.resolve();
      }
      return run(() => api.createGame<S>(gameType, aiStrategy, config), local);
    },
    [gameType, run],
  );

  const play = useCallback(
    async (move: number | string) => {
      if (game === null) return;
      if (isLocalGame(game)) {
        try {
          const next = playLocal(game, move);
          setGame(next);
          if (next.status === "finished") {
            enqueue(toOfflineGame(next));
            notifyQueueChanged();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Coup invalide.");
        }
        return;
      }
      await run(() => api.playMove<S>(game.id, move));
    },
    [game, run],
  );

  const reset = useCallback(() => {
    setGame(null);
    setError(null);
    setOffline(false);
  }, []);

  return { game, busy, error, offline, start, play, reset };
}
