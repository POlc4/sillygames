// Serveur MSW partagé par les tests : simule l'API backend (jamais le vrai serveur).

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { Game, Player, RpsState, SticksState } from "@/lib/api";

export const GUEST: Player = {
  id: "11111111-1111-1111-1111-111111111111",
  username: null,
  is_guest: true,
  created_at: "2026-09-10T00:00:00Z",
};

export const ALICE: Player = {
  ...GUEST,
  id: "22222222-2222-2222-2222-222222222222",
  username: "alice",
  is_guest: false,
};

export function sticksGame(
  state: Partial<SticksState> = {},
  extra: Partial<Game<SticksState>> = {},
): Game<SticksState> {
  return {
    id: "game-sticks-1",
    game_type: "sticks",
    ai_strategy: "random",
    config: { sticks: 21, first: "player" },
    status: "in_progress",
    result: null,
    started_at: "2026-09-10T00:00:00Z",
    finished_at: null,
    state: {
      sticks: 21,
      current: "player",
      winner: null,
      legal_moves: [1, 2, 3],
      finished: false,
      ...state,
    },
    moves: [],
    ...extra,
  };
}

export function rpsGame(
  state: Partial<RpsState> = {},
  extra: Partial<Game<RpsState>> = {},
): Game<RpsState> {
  return {
    id: "game-rps-1",
    game_type: "rps",
    ai_strategy: "random",
    config: { rounds: 3 },
    status: "in_progress",
    result: null,
    started_at: "2026-09-10T00:00:00Z",
    finished_at: null,
    state: {
      total_rounds: 3,
      rounds: [],
      player_score: 0,
      ai_score: 0,
      finished: false,
      legal_moves: ["rock", "paper", "scissors"],
      ...state,
    },
    moves: [],
    ...extra,
  };
}

// Par défaut : session invitée déjà ouverte.
export const defaultHandlers = [
  http.get("*/api/auth/me", () => HttpResponse.json(GUEST)),
  http.post("*/api/auth/guest", () => HttpResponse.json(GUEST)),
  http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/auth/providers", () => HttpResponse.json([])),
];

export const server = setupServer(...defaultHandlers);
export { http, HttpResponse };
