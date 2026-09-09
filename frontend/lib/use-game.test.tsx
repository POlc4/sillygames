import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RpsState, SticksState } from "@/lib/api";
import { clearQueue, pendingGames } from "@/lib/offline";
import { useGame } from "@/lib/use-game";
import { http, HttpResponse, server, sticksGame } from "@/tests/msw/server";

describe("useGame", () => {
  beforeEach(() => clearQueue());
  afterEach(() => vi.restoreAllMocks());

  it("plays online through the API", async () => {
    server.use(
      http.post("*/api/games", () => HttpResponse.json(sticksGame(), { status: 201 })),
      http.post("*/api/games/game-sticks-1/moves", () =>
        HttpResponse.json(sticksGame({ sticks: 18 })),
      ),
    );
    const { result } = renderHook(() => useGame<SticksState>("sticks"));
    await act(() => result.current.start("random", { sticks: 21 }));
    expect(result.current.game?.id).toBe("game-sticks-1");
    expect(result.current.offline).toBe(false);
    await act(() => result.current.play(2));
    expect(result.current.game?.state.sticks).toBe(18);
  });

  it("falls back to a local game when the server is unreachable, then queues the result", async () => {
    server.use(http.post("*/api/games", () => HttpResponse.error()));
    const { result } = renderHook(() => useGame<RpsState>("rps"));
    await act(() => result.current.start("random", { rounds: 1 }));
    expect(result.current.offline).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.game?.id).toMatch(/^local:/);

    await act(() => result.current.play("rock"));
    await waitFor(() => expect(result.current.game?.status).toBe("finished"));
    expect(pendingGames()).toHaveLength(1);
    expect(pendingGames()[0].turns[0].player_move).toBe("rock");
  });

  it("starts locally right away when the browser is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useGame<SticksState>("sticks"));
    await act(() => result.current.start("perfect", { sticks: 10 }));
    expect(result.current.offline).toBe(true);
    expect(result.current.game?.state.sticks).toBe(10);
  });

  it("keeps business errors as errors, without falling back", async () => {
    server.use(
      http.post("*/api/games", () => HttpResponse.json({ detail: "nope" }, { status: 422 })),
    );
    const { result } = renderHook(() => useGame<SticksState>("sticks"));
    await act(() => result.current.start("random", {}));
    expect(result.current.game).toBeNull();
    expect(result.current.offline).toBe(false);
    expect(result.current.error).toBe("nope");
  });

  it("reports illegal local moves and reset clears everything", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useGame<SticksState>("sticks"));
    await act(() => result.current.start("random", { sticks: 10 }));
    await act(() => result.current.play(4));
    expect(result.current.error).toMatch(/cannot take 4/);
    act(() => result.current.reset());
    expect(result.current.game).toBeNull();
    expect(result.current.offline).toBe(false);
  });
});
