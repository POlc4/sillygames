// Portage TypeScript du moteur pierre-feuille-ciseaux (backend/app/games/rps.py).

import type { Outcome, RpsMove, RpsRound, RpsState } from "@/lib/api";

import { IllegalMoveError } from "./sticks";

export const DEFAULT_ROUNDS = 5;
export const MOVES: readonly RpsMove[] = ["rock", "paper", "scissors"];

/** Chaque coup bat celui indiqué. */
export const BEATS: Record<RpsMove, RpsMove> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function resolve(player: RpsMove, ai: RpsMove): Outcome {
  if (player === ai) return "draw";
  return BEATS[player] === ai ? "win" : "loss";
}

/** Le coup qui bat `move`. */
export function counter(move: RpsMove): RpsMove {
  return (Object.keys(BEATS) as RpsMove[]).find((m) => BEATS[m] === move) as RpsMove;
}

function withScores(total_rounds: number, rounds: RpsRound[]): RpsState {
  const finished = rounds.length >= total_rounds;
  return {
    total_rounds,
    rounds,
    player_score: rounds.filter((r) => r.outcome === "win").length,
    ai_score: rounds.filter((r) => r.outcome === "loss").length,
    finished,
    legal_moves: finished ? [] : [...MOVES],
  };
}

export function newGame(total_rounds = DEFAULT_ROUNDS): RpsState {
  if (!Number.isInteger(total_rounds) || total_rounds < 1) {
    throw new RangeError("total_rounds must be at least 1");
  }
  return withScores(total_rounds, []);
}

export function playRound(state: RpsState, player: RpsMove, ai: RpsMove): RpsState {
  if (state.finished) throw new IllegalMoveError("game is finished");
  const round: RpsRound = { player, ai, outcome: resolve(player, ai) };
  return withScores(state.total_rounds, [...state.rounds, round]);
}

export function result(state: RpsState): Outcome | null {
  if (!state.finished) return null;
  if (state.player_score > state.ai_score) return "win";
  if (state.player_score < state.ai_score) return "loss";
  return "draw";
}
