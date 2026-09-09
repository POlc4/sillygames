import { describe, expect, it } from "vitest";

import type { RpsState, SticksState } from "@/lib/api";
import { seeded } from "@/lib/engines/rng";
import { winningMove } from "@/lib/engines/sticks";
import { createLocalGame, isLocalGame, playLocal } from "@/lib/local-game";

describe("local games", () => {
  it("creates a sticks game in the API shape", () => {
    const game = createLocalGame<SticksState>("sticks", "random", { sticks: 10, first: "player" });
    expect(isLocalGame(game)).toBe(true);
    expect(game.config).toEqual({ sticks: 10, first: "player" });
    expect(game.state.sticks).toBe(10);
    expect(game.moves).toEqual([]);
    expect(game.status).toBe("in_progress");
  });

  it("records the AI opening as turn 0 and resolves a random first player", () => {
    const game = createLocalGame<SticksState>(
      "sticks",
      "perfect",
      { sticks: 22, first: "ai" },
      seeded(1),
    );
    expect(game.moves[0]).toMatchObject({ turn: 0, player_move: null, ai_move: "1" });
    expect(game.state.sticks).toBe(21);
    const resolved = createLocalGame<SticksState>(
      "sticks",
      "random",
      { first: "random" },
      seeded(3),
    );
    expect(["player", "ai"]).toContain(resolved.config.first);
  });

  it("plays a full sticks game to a win with the 4k+1 strategy", () => {
    let game = createLocalGame<SticksState>("sticks", "random", { sticks: 22 }, seeded(5));
    let turns = 0;
    while (game.status === "in_progress") {
      game = playLocal(game, winningMove(game.state.sticks) ?? 1, seeded(turns));
      turns += 1;
    }
    expect(game.result).toBe("win");
    expect(game.finished_at).not.toBeNull();
    expect(game.moves.map((m) => m.turn)).toEqual(Array.from({ length: turns }, (_, i) => i + 1));
    expect(() => playLocal(game, 1)).toThrow(/finished/);
  });

  it("rejects illegal sticks moves without changing the game", () => {
    const game = createLocalGame<SticksState>("sticks", "random", { sticks: 10 });
    expect(() => playLocal(game, 4)).toThrow(/cannot take 4/);
    expect(() => playLocal(game, "2")).toThrow(/number/);
    expect(game.moves).toHaveLength(0);
  });

  it("plays rock-paper-scissors locally", () => {
    let game = createLocalGame<RpsState>("rps", "random", { rounds: 2 }, seeded(9));
    game = playLocal(game, "rock", seeded(1));
    expect(game.state.rounds).toHaveLength(1);
    expect(game.moves[0]).toMatchObject({ turn: 1, player_move: "rock" });
    expect(["rock", "paper", "scissors"]).toContain(game.moves[0].ai_move);
    game = playLocal(game, "paper", seeded(2));
    expect(game.status).toBe("finished");
    expect(["win", "loss", "draw"]).toContain(game.result);
    expect(() => playLocal(createLocalGame<RpsState>("rps", "random", {}), "stone")).toThrow(
      /invalid/,
    );
  });
});
