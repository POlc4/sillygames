// Stratégies d'IA hors ligne : aléatoire (deux jeux) et parfaite (bâtonnets).
// Miroir de backend/app/games/ai/random_strategy.py et perfect.py.

import type { RpsMove, RpsState, SticksState } from "@/lib/api";

import { pick, type Rng } from "./rng";
import { MOVES } from "./rps";
import { legalMoves, winningMove } from "./sticks";

export type SticksStrategy = (state: SticksState) => number;
export type RpsStrategy = (state: RpsState) => RpsMove;

export function randomSticks(rng: Rng): SticksStrategy {
  return (state) => pick(rng, legalMoves(state));
}

export function perfectSticks(rng: Rng): SticksStrategy {
  return (state) => winningMove(state.sticks) ?? pick(rng, legalMoves(state));
}

export function randomRps(rng: Rng): RpsStrategy {
  return () => pick(rng, MOVES);
}

export const STICKS_STRATEGIES: Record<string, (rng: Rng) => SticksStrategy> = {
  random: randomSticks,
  perfect: perfectSticks,
};

export const RPS_STRATEGIES: Record<string, (rng: Rng) => RpsStrategy> = {
  random: randomRps,
};
