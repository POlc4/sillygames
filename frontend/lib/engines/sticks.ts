// Portage TypeScript du moteur des bâtonnets (backend/app/games/sticks.py), pour le jeu hors
// ligne (phase 3, palier 2). Mêmes règles, mêmes tests. Le serveur reste la source de vérité :
// une partie jouée hors ligne est rejouée et validée par lui à la synchronisation.

import type { SticksState } from "@/lib/api";

export const MIN_STICKS = 5;
export const MAX_STICKS = 50;
export const DEFAULT_STICKS = 21;
export const MAX_TAKE = 3;

export type Side = "player" | "ai";

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMoveError";
  }
}

export function other(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

export function legalMoves(state: Pick<SticksState, "sticks" | "finished">): number[] {
  if (state.finished) return [];
  return Array.from({ length: Math.min(MAX_TAKE, state.sticks) }, (_, i) => i + 1);
}

export function newGame(sticks = DEFAULT_STICKS, first: Side = "player"): SticksState {
  if (!Number.isInteger(sticks) || sticks < MIN_STICKS || sticks > MAX_STICKS) {
    throw new RangeError(`sticks must be between ${MIN_STICKS} and ${MAX_STICKS}, got ${sticks}`);
  }
  const state = { sticks, current: first, winner: null, finished: false };
  return { ...state, legal_moves: legalMoves(state) };
}

export function apply(state: SticksState, take: number): SticksState {
  if (state.finished) throw new IllegalMoveError("game is finished");
  if (!legalMoves(state).includes(take)) {
    throw new IllegalMoveError(`cannot take ${take} sticks with ${state.sticks} remaining`);
  }
  const remaining = state.sticks - take;
  if (remaining === 0) {
    // Celui qui prend le dernier bâtonnet perd.
    return {
      sticks: 0,
      current: state.current,
      winner: other(state.current),
      finished: true,
      legal_moves: [],
    };
  }
  const next = { sticks: remaining, current: other(state.current), winner: null, finished: false };
  return { ...next, legal_moves: legalMoves(next) };
}

/** Vrai si celui qui doit jouer avec `sticks` bâtonnets perd face à un jeu parfait. */
export function isLosingPosition(sticks: number): boolean {
  return sticks % 4 === 1;
}

/** Coup qui laisse 4k+1 bâtonnets à l'adversaire, ou null en position perdante. */
export function winningMove(sticks: number): number | null {
  const take = (sticks - 1) % 4;
  return take >= 1 && take <= MAX_TAKE ? take : null;
}
