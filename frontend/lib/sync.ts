// Synchronisation des parties hors ligne : chaque partie de la file est envoyée à
// POST /api/games/import ; le serveur la rejoue et la valide (ADR 0005).

import { api, ApiError } from "@/lib/api";
import { isOnline, pendingGames, remove } from "@/lib/offline";

export type SyncReport = { sent: number; dropped: number; remaining: number };

let inFlight: Promise<SyncReport> | null = null;

export function syncOfflineGames(): Promise<SyncReport> {
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, dropped: 0, remaining: 0 };
  if (!isOnline()) {
    report.remaining = pendingGames().length;
    return report;
  }
  for (const game of pendingGames()) {
    try {
      await api.importGame({
        game_type: game.game_type,
        ai_strategy: game.ai_strategy,
        config: game.config,
        turns: game.turns,
        started_at: game.started_at,
        finished_at: game.finished_at,
      });
      remove(game.local_id);
      report.sent += 1;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // Partie refusée par le rejeu (incohérente) : inutile de réessayer.
        remove(game.local_id);
        report.dropped += 1;
      } else {
        // Réseau ou serveur indisponible, ou session absente : on garde pour plus tard.
        report.remaining += 1;
      }
    }
  }
  return report;
}
