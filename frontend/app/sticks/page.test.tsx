import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import SticksPage from "@/app/sticks/page";
import { SessionProvider } from "@/lib/session";
import { http, HttpResponse, server, sticksGame } from "@/tests/msw/server";

function renderPage() {
  return render(
    <SessionProvider>
      <SticksPage />
    </SessionProvider>,
  );
}

describe("Sticks page", () => {
  it("creates a game with the chosen options, then plays a turn", async () => {
    let created: unknown = null;
    let played: unknown = null;
    server.use(
      http.post("*/api/games", async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(sticksGame({ sticks: 10 }, { ai_strategy: "perfect" }), {
          status: 201,
        });
      }),
      http.post("*/api/games/game-sticks-1/moves", async ({ request }) => {
        played = await request.json();
        return HttpResponse.json(
          sticksGame(
            { sticks: 5 },
            {
              moves: [
                {
                  turn: 1,
                  player_move: "2",
                  ai_move: "3",
                  state_before: sticksGame({ sticks: 10 }).state,
                  state_after: sticksGame({ sticks: 5 }).state,
                  created_at: "2026-09-10T00:00:00Z",
                },
              ],
            },
          ),
        );
      }),
    );
    renderPage();

    const user = userEvent.setup();
    const input = screen.getByLabelText(/Nombre de bâtonnets/);
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByLabelText("Expert"));
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    await waitFor(() => expect(screen.getAllByTestId("stick")).toHaveLength(10));
    expect(created).toEqual({
      game_type: "sticks",
      ai_strategy: "perfect",
      config: { sticks: 10, first: "player" },
    });

    await user.click(screen.getByRole("button", { name: "Retirer 2" }));
    await waitFor(() => expect(screen.getAllByTestId("stick")).toHaveLength(5));
    expect(played).toEqual({ move: 2 });
    expect(screen.getByText("L'IA a retiré 3 bâtonnets.")).toBeInTheDocument();
  });

  it("shows the result and the tip after a loss, and lets the player replay", async () => {
    server.use(
      http.post("*/api/games", () =>
        HttpResponse.json(
          sticksGame(
            { sticks: 0, finished: true, winner: "ai", legal_moves: [] },
            { status: "finished", result: "loss" },
          ),
          { status: 201 },
        ),
      ),
    );
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Commencer" }));
    await screen.findByRole("status");
    expect(screen.getByText("L'IA a gagné.")).toBeInTheDocument();
    expect(screen.getByText(/Astuce/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rejouer" }));
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });

  it("surfaces backend errors", async () => {
    server.use(
      http.post("*/api/games", () =>
        HttpResponse.json({ detail: "unknown strategy" }, { status: 422 }),
      ),
    );
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Commencer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unknown strategy");
  });
});
