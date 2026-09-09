import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatsPage from "@/app/stats/page";
import { SessionProvider } from "@/lib/session";
import { http, HttpResponse, server } from "@/tests/msw/server";

describe("Stats page", () => {
  it("renders personal, global and leaderboard data", async () => {
    server.use(
      http.get("*/api/stats/me", () =>
        HttpResponse.json({
          lines: [
            {
              game_type: "sticks",
              ai_strategy: "perfect",
              games: 4,
              wins: 1,
              losses: 3,
              draws: 0,
              win_rate: 0.25,
            },
          ],
          games: 4,
          wins: 1,
        }),
      ),
      http.get("*/api/stats/global", () =>
        HttpResponse.json({
          lines: [
            {
              game_type: "rps",
              ai_strategy: "random",
              games: 10,
              wins: 3,
              losses: 5,
              draws: 2,
              win_rate: 0.3,
            },
          ],
          games: 10,
          wins: 3,
          players: 6,
        }),
      ),
      http.get("*/api/stats/leaderboard", () =>
        HttpResponse.json([{ username: "carol", games: 2, wins: 2, win_rate: 1 }]),
      ),
    );
    render(
      <SessionProvider>
        <StatsPage />
      </SessionProvider>,
    );

    expect(await screen.findByText("4 parties terminées, 1 victoire.")).toBeInTheDocument();
    expect(screen.getByText("expert")).toBeInTheDocument();
    expect(screen.getByText("25 %")).toBeInTheDocument();
    expect(screen.getByText("6 joueurs, 10 parties terminées.")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
    expect(screen.getByText(/2 victoires sur 2 \(100 %\)/)).toBeInTheDocument();
  });

  it("shows empty states and errors", async () => {
    server.use(
      http.get("*/api/stats/me", () => HttpResponse.json({ lines: [], games: 0, wins: 0 })),
      http.get("*/api/stats/global", () =>
        HttpResponse.json({ lines: [], games: 0, wins: 0, players: 1 }),
      ),
      http.get("*/api/stats/leaderboard", () => HttpResponse.json([])),
    );
    render(
      <SessionProvider>
        <StatsPage />
      </SessionProvider>,
    );
    expect(
      await screen.findByText("Aucun joueur inscrit n'a terminé de partie."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Aucune partie terminée pour l'instant.")).toHaveLength(2);

    server.use(
      http.get("*/api/stats/me", () => HttpResponse.json({ detail: "x" }, { status: 500 })),
    );
    render(
      <SessionProvider>
        <StatsPage />
      </SessionProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossible de charger les statistiques.",
    );
  });
});
