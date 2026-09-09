// File d'attente des parties jouées hors ligne, en attente de synchronisation (palier 2 PWA).
// localStorage suffit ici (quelques parties, quelques Ko) et se teste dans jsdom ; IndexedDB
// n'apporterait rien tant que le volume reste de cet ordre.

import type { Game, GameType, RpsState, SticksState } from "@/lib/api";

const KEY = "sillygames.offline.v1";

export type OfflineTurn = { player_move: number | string | null; ai_move: number | string | null };

export type OfflineGame = {
  local_id: string;
  game_type: GameType;
  ai_strategy: string;
  config: Record<string, unknown>;
  turns: OfflineTurn[];
  started_at: string;
  finished_at: string;
};

function read(): OfflineGame[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineGame[]) : [];
  } catch {
    return [];
  }
}

function write(games: OfflineGame[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(games));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la partie est simplement perdue.
  }
}

export function pendingGames(): OfflineGame[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

export function enqueue(game: OfflineGame): void {
  write([...read().filter((g) => g.local_id !== game.local_id), game]);
}

export function remove(localId: string): void {
  write(read().filter((g) => g.local_id !== localId));
}

export function clearQueue(): void {
  write([]);
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Convertit une partie locale terminée en entrée de file (coups joueur/IA par tour). */
export function toOfflineGame(game: Game<SticksState | RpsState>): OfflineGame {
  return {
    local_id: game.id,
    game_type: game.game_type,
    ai_strategy: game.ai_strategy,
    config: Object.fromEntries(Object.entries(game.config).filter(([k]) => k !== "offline")),
    turns: game.moves.map((m) => ({
      player_move: parseMove(game.game_type, m.player_move),
      ai_move: parseMove(game.game_type, m.ai_move),
    })),
    started_at: game.started_at,
    finished_at: game.finished_at ?? new Date().toISOString(),
  };
}

function parseMove(type: GameType, value: string | null): number | string | null {
  if (value === null) return null;
  return type === "sticks" ? Number(value) : value;
}
