import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import RpsPage from "@/app/rps/page";
import { SessionProvider } from "@/lib/session";
import { http, HttpResponse, rpsGame, server } from "@/tests/msw/server";

describe("RPS page", () => {
  it("plays rounds until the game is finished", async () => {
    let created: unknown = null;
    server.use(
      http.post("*/api/games", async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(rpsGame({ total_rounds: 1 }, { config: { rounds: 1 } }), {
          status: 201,
        });
      }),
      http.post("*/api/games/game-rps-1/moves", () =>
        HttpResponse.json(
          rpsGame(
            {
              total_rounds: 1,
              rounds: [{ player: "rock", ai: "scissors", outcome: "win" }],
              player_score: 1,
              finished: true,
              legal_moves: [],
            },
            { status: "finished", result: "win" },
          ),
        ),
      ),
    );
    render(
      <SessionProvider>
        <RpsPage />
      </SessionProvider>,
    );

    const user = userEvent.setup();
    const input = screen.getByLabelText(/Nombre de manches/);
    await user.clear(input);
    await user.type(input, "1");
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await screen.findByText(/Manche 1 \/ 1/);
    expect(created).toEqual({ game_type: "rps", ai_strategy: "random", config: { rounds: 1 } });

    await user.click(screen.getByRole("button", { name: "Pierre" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Vous avez gagné !"));
    expect(screen.getByText(/Vous : Pierre\. IA : Ciseaux\. Manche gagnée\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pierre" })).toBeDisabled();
  });
});
