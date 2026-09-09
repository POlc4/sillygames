import { describe, expect, it } from "vitest";

import {
  highlightedIndices,
  PER_ROW,
  stickPositions,
  takeCountForHover,
} from "@/components/three/sticksLayout";

describe("stickPositions", () => {
  it("lays sticks out in rows of five, centered", () => {
    const positions = stickPositions(7);
    expect(positions).toHaveLength(7);
    expect(positions[0][0]).toBeCloseTo(-positions[4][0]);
    expect(positions[0][2]).toBeCloseTo(-positions[5][2]);
    expect(positions[5][0]).toBeCloseTo(positions[0][0]);
  });

  it("keeps earlier sticks in place when the count shrinks", () => {
    const before = stickPositions(21);
    const after = stickPositions(18);
    for (let i = 0; i < 3 * PER_ROW; i++) {
      expect(after[i][0]).toBeCloseTo(before[i][0]);
    }
  });

  it("handles zero sticks", () => {
    expect(stickPositions(0)).toEqual([]);
  });
});

describe("takeCountForHover", () => {
  it("proposes to take the hovered stick and those after it", () => {
    expect(takeCountForHover(20, 21, [1, 2, 3])).toBe(1);
    expect(takeCountForHover(18, 21, [1, 2, 3])).toBe(3);
  });

  it("refuses more than the legal moves allow", () => {
    expect(takeCountForHover(17, 21, [1, 2, 3])).toBe(0);
    expect(takeCountForHover(0, 2, [1, 2])).toBe(2);
    expect(takeCountForHover(0, 3, [1, 2])).toBe(0);
  });
});

describe("highlightedIndices", () => {
  it("returns the last `count` indices", () => {
    expect(highlightedIndices(3, 21)).toEqual([18, 19, 20]);
    expect(highlightedIndices(1, 1)).toEqual([0]);
    expect(highlightedIndices(0, 21)).toEqual([]);
  });
});
