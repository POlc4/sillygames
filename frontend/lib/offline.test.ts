import { beforeEach, describe, expect, it } from "vitest";

import type { Game, SticksState } from "@/lib/api";
import {
  clearQueue,
  enqueue,
  pendingCount,
  pendingGames,
  remove,
  toOfflineGame,
  type OfflineGame,
} from "@/lib/offline";

const entry = (id: string): OfflineGame => ({
  local_id: id,
  game_type: "rps",
  ai_strategy: "random",
  config: { rounds: 1 },
  turns: [{ player_move: "rock", ai_move: "rock" }],
  started_at: "2026-09-10T00:00:00Z",
  finished_at: "2026-09-10T00:00:01Z",
});

describe("offline queue", () => {
  beforeEach(() => clearQueue());

  it("stores, replaces and removes games", () => {
    enqueue(entry("a"));
    enqueue(entry("b"));
    enqueue({ ...entry("a"), ai_strategy: "ml" });
    expect(pendingCount()).toBe(2);
    expect(pendingGames().find((g) => g.local_id === "a")?.ai_strategy).toBe("ml");
    remove("a");
    expect(pendingGames().map((g) => g.local_id)).toEqual(["b"]);
  });

  it("survives a corrupted storage value", () => {
    window.localStorage.setItem("sillygames.offline.v1", "{not json");
    expect(pendingGames()).toEqual([]);
  });

  it("converts a finished local sticks game into turns with numeric moves", () => {
    const state: SticksState = {
      sticks: 0,
      current: "ai",
      winner: "player",
      finished: true,
      legal_moves: [],
    };
    const game: Game<SticksState> = {
      id: "local:x",
      game_type: "sticks",
      ai_strategy: "perfect",
      config: { sticks: 5, first: "ai", offline: true },
      status: "finished",
      result: "win",
      started_at: "2026-09-10T00:00:00Z",
      finished_at: "2026-09-10T00:01:00Z",
      state,
      moves: [
        {
          turn: 0,
          player_move: null,
          ai_move: "1",
          state_before: state,
          state_after: state,
          created_at: "",
        },
        {
          turn: 1,
          player_move: "3",
          ai_move: "1",
          state_before: state,
          state_after: state,
          created_at: "",
        },
      ],
    };
    expect(toOfflineGame(game)).toEqual({
      local_id: "local:x",
      game_type: "sticks",
      ai_strategy: "perfect",
      config: { sticks: 5, first: "ai" },
      turns: [
        { player_move: null, ai_move: 1 },
        { player_move: 3, ai_move: 1 },
      ],
      started_at: "2026-09-10T00:00:00Z",
      finished_at: "2026-09-10T00:01:00Z",
    });
  });
});
