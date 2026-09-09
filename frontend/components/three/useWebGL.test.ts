import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectWebGL, useWebGL } from "@/components/three/useWebGL";

describe("useWebGL", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is false when the canvas has no WebGL context (jsdom)", () => {
    expect(detectWebGL()).toBe(false);
    expect(renderHook(() => useWebGL()).result.current).toBe(false);
  });

  it("is true when a WebGL context is available", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    expect(renderHook(() => useWebGL()).result.current).toBe(true);
  });

  it("is false when creating the context throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("no gpu");
    });
    expect(detectWebGL()).toBe(false);
  });
});
