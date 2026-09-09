import { describe, expect, it } from "vitest";

import * as sticks from "@/lib/engines/sticks";

describe("sticks engine (TypeScript port)", () => {
  it("starts with defaults", () => {
    const state = sticks.newGame();
    expect(state).toEqual({
      sticks: 21,
      current: "player",
      winner: null,
      finished: false,
      legal_moves: [1, 2, 3],
    });
  });

  it.each([4, 0, -1, 51, 100, 7.5])("rejects %s sticks", (n) => {
    expect(() => sticks.newGame(n)).toThrow(RangeError);
  });

  it("lets the AI start", () => {
    expect(sticks.newGame(21, "ai").current).toBe("ai");
  });

  it("caps legal moves by the remaining sticks", () => {
    expect(sticks.legalMoves({ sticks: 2, finished: false })).toEqual([1, 2]);
    expect(sticks.legalMoves({ sticks: 1, finished: false })).toEqual([1]);
    expect(sticks.legalMoves({ sticks: 1, finished: true })).toEqual([]);
  });

  it("alternates turns", () => {
    let state = sticks.apply(sticks.newGame(21), 2);
    expect(state.sticks).toBe(19);
    expect(state.current).toBe("ai");
    state = sticks.apply(state, 3);
    expect(state.sticks).toBe(16);
    expect(state.current).toBe("player");
  });

  it.each([0, 4, -1])("rejects taking %s", (take) => {
    expect(() => sticks.apply(sticks.newGame(21), take)).toThrow(sticks.IllegalMoveError);
  });

  it("rejects taking more than remaining", () => {
    const state = { ...sticks.newGame(5), sticks: 2, legal_moves: [1, 2] };
    expect(() => sticks.apply(state, 3)).toThrow(sticks.IllegalMoveError);
  });

  it("taking the last stick loses", () => {
    const state = sticks.apply({ ...sticks.newGame(5), sticks: 1, legal_moves: [1] }, 1);
    expect(state.finished).toBe(true);
    expect(state.winner).toBe("ai");
    expect(state.legal_moves).toEqual([]);
    expect(() => sticks.apply(state, 1)).toThrow(sticks.IllegalMoveError);
  });

  it("the AI taking the last stick makes the player win", () => {
    const state = sticks.apply({ ...sticks.newGame(5, "ai"), sticks: 3 }, 3);
    expect(state.winner).toBe("player");
  });

  it.each([1, 5, 9, 13, 21, 49])("%s is a losing position", (n) => {
    expect(sticks.isLosingPosition(n)).toBe(true);
    expect(sticks.winningMove(n)).toBeNull();
  });

  it.each([
    [2, 1],
    [3, 2],
    [4, 3],
    [6, 1],
    [22, 1],
    [24, 3],
  ])("winning move from %s leaves 4k+1 (take %s)", (n, expected) => {
    expect(sticks.winningMove(n)).toBe(expected);
    expect((n - expected) % 4).toBe(1);
  });
});
