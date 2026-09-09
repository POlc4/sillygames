import { describe, expect, it } from "vitest";

import type { RpsMove } from "@/lib/api";
import * as rps from "@/lib/engines/rps";
import { IllegalMoveError } from "@/lib/engines/sticks";

describe("rps engine (TypeScript port)", () => {
  it.each<[RpsMove, RpsMove, string]>([
    ["rock", "rock", "draw"],
    ["paper", "paper", "draw"],
    ["scissors", "scissors", "draw"],
    ["rock", "scissors", "win"],
    ["paper", "rock", "win"],
    ["scissors", "paper", "win"],
    ["rock", "paper", "loss"],
    ["paper", "scissors", "loss"],
    ["scissors", "rock", "loss"],
  ])("%s vs %s is a %s", (player, ai, outcome) => {
    expect(rps.resolve(player, ai)).toBe(outcome);
  });

  it.each(rps.MOVES)("counter(%s) beats it", (move) => {
    expect(rps.resolve(rps.counter(move), move)).toBe("win");
  });

  it("rejects zero rounds", () => {
    expect(() => rps.newGame(0)).toThrow(RangeError);
  });

  it("plays a full game and computes the result", () => {
    let state = rps.newGame(5);
    for (const [p, a] of [
      ["rock", "scissors"],
      ["paper", "rock"],
      ["scissors", "scissors"],
      ["rock", "paper"],
      ["scissors", "paper"],
    ] as [RpsMove, RpsMove][]) {
      expect(state.finished).toBe(false);
      expect(rps.result(state)).toBeNull();
      state = rps.playRound(state, p, a);
    }
    expect(state.finished).toBe(true);
    expect(state.player_score).toBe(3);
    expect(state.ai_score).toBe(1);
    expect(state.legal_moves).toEqual([]);
    expect(rps.result(state)).toBe("win");
    expect(() => rps.playRound(state, "rock", "rock")).toThrow(IllegalMoveError);
  });

  it("reports draws and losses", () => {
    let draw = rps.newGame(2);
    draw = rps.playRound(draw, "rock", "paper");
    draw = rps.playRound(draw, "paper", "rock");
    expect(rps.result(draw)).toBe("draw");
    expect(rps.result(rps.playRound(rps.newGame(1), "rock", "paper"))).toBe("loss");
  });

  it("does not mutate the previous state", () => {
    const start = rps.newGame(2);
    const after = rps.playRound(start, "rock", "scissors");
    expect(start.rounds).toHaveLength(0);
    expect(after.rounds).toHaveLength(1);
  });
});
