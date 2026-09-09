import { describe, expect, it } from "vitest";

import type { SticksState } from "@/lib/api";
import { perfectSticks, randomRps, randomSticks } from "@/lib/engines/ai";
import { pick, seeded } from "@/lib/engines/rng";
import * as rps from "@/lib/engines/rps";
import * as sticks from "@/lib/engines/sticks";

function playOut(
  state: SticksState,
  ai: (s: SticksState) => number,
  opponent: (s: SticksState) => number,
): "player" | "ai" {
  while (!state.finished) {
    state = sticks.apply(state, state.current === "ai" ? ai(state) : opponent(state));
  }
  return state.winner as "player" | "ai";
}

describe("seeded rng", () => {
  it("is deterministic and uniform enough", () => {
    const a = seeded(7);
    const b = seeded(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const counts = [0, 0, 0];
    const rng = seeded(1);
    for (let i = 0; i < 3000; i++) counts[pick(rng, [0, 1, 2])] += 1;
    for (const c of counts) expect(c).toBeGreaterThan(800);
    expect(() => pick(rng, [])).toThrow(RangeError);
  });
});

describe("offline strategies", () => {
  it("random sticks only plays legal moves", () => {
    const ai = randomSticks(seeded(1));
    for (let n = sticks.MIN_STICKS; n <= sticks.MAX_STICKS; n++) {
      const state = { ...sticks.newGame(n, "ai") };
      for (let i = 0; i < 10; i++) expect(state.legal_moves).toContain(ai(state));
    }
  });

  it("random rps covers all moves", () => {
    const ai = randomRps(seeded(1));
    const seen = new Set(Array.from({ length: 200 }, () => ai(rps.newGame())));
    expect(seen).toEqual(new Set(["rock", "paper", "scissors"]));
  });

  it("perfect sticks always wins from a winning position", () => {
    const ai = perfectSticks(seeded(0));
    const opponent = randomSticks(seeded(2));
    for (let n = sticks.MIN_STICKS; n <= sticks.MAX_STICKS; n++) {
      const first = n % 4 === 1 ? "player" : "ai";
      for (let i = 0; i < 10; i++) {
        expect(playOut(sticks.newGame(n, first), ai, opponent)).toBe("ai");
      }
    }
  });

  it("perfect vs perfect: the position decides", () => {
    const a = perfectSticks(seeded(0));
    const b = perfectSticks(seeded(1));
    expect(playOut(sticks.newGame(21, "player"), a, b)).toBe("ai");
    expect(playOut(sticks.newGame(21, "ai"), a, b)).toBe("player");
  });
});
