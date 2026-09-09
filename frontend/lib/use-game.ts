"use client";

// Cycle de vie d'une partie côté client : création, coups, erreurs. Aucune règle de jeu ici,
// le serveur est la source de vérité et renvoie l'état complet après chaque coup.

import { useCallback, useState } from "react";

import { api, ApiError, type Game, type GameType } from "@/lib/api";

export type GameHook<S> = {
  game: Game<S> | null;
  busy: boolean;
  error: string | null;
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

export function useGame<S>(gameType: GameType): GameHook<S> {
  const [game, setGame] = useState<Game<S> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<Game<S>>) => {
    setBusy(true);
    setError(null);
    try {
      setGame(await action());
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    (aiStrategy: string, config: Record<string, unknown>) =>
      run(() => api.createGame<S>(gameType, aiStrategy, config)),
    [gameType, run],
  );

  const play = useCallback(
    async (move: number | string) => {
      if (game === null) return;
      await run(() => api.playMove<S>(game.id, move));
    },
    [game, run],
  );

  const reset = useCallback(() => {
    setGame(null);
    setError(null);
  }, []);

  return { game, busy, error, start, play, reset };
}
