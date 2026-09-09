import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueue, enqueue, pendingGames, type OfflineGame } from "@/lib/offline";
import { syncOfflineGames } from "@/lib/sync";
import { http, HttpResponse, server } from "@/tests/msw/server";

const entry = (id: string): OfflineGame => ({
  local_id: id,
  game_type: "rps",
  ai_strategy: "random",
  config: { rounds: 1 },
  turns: [{ player_move: "rock", ai_move: "rock" }],
  started_at: "2026-09-10T00:00:00Z",
  finished_at: "2026-09-10T00:00:01Z",
});

describe("syncOfflineGames", () => {
  beforeEach(() => clearQueue());
  afterEach(() => vi.restoreAllMocks());

  it("sends every queued game and removes the accepted ones", async () => {
    const received: unknown[] = [];
    server.use(
      http.post("*/api/games/import", async ({ request }) => {
        received.push(await request.json());
        return HttpResponse.json({ id: "g" }, { status: 201 });
      }),
    );
    enqueue(entry("a"));
    enqueue(entry("b"));
    const report = await syncOfflineGames();
    expect(report).toEqual({ sent: 2, dropped: 0, remaining: 0 });
    expect(pendingGames()).toEqual([]);
    expect(received[0]).toMatchObject({
      game_type: "rps",
      turns: [{ player_move: "rock", ai_move: "rock" }],
    });
  });

  it("drops games the server rejects as invalid, keeps the others on outages", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/games/import", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ detail: "game is not finished" }, { status: 422 })
          : HttpResponse.json({ detail: "down" }, { status: 503 });
      }),
    );
    enqueue(entry("invalid"));
    enqueue(entry("later"));
    const report = await syncOfflineGames();
    expect(report).toEqual({ sent: 0, dropped: 1, remaining: 1 });
    expect(pendingGames().map((g) => g.local_id)).toEqual(["later"]);
  });

  it("does nothing while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    enqueue(entry("a"));
    expect(await syncOfflineGames()).toEqual({ sent: 0, dropped: 0, remaining: 1 });
  });
});
