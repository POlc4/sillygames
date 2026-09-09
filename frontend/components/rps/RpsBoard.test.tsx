import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RpsBoard } from "@/components/rps/RpsBoard";
import type { RpsState } from "@/lib/api";

const base: RpsState = {
  total_rounds: 3,
  rounds: [],
  player_score: 0,
  ai_score: 0,
  finished: false,
  legal_moves: ["rock", "paper", "scissors"],
};

describe("RpsBoard", () => {
  it("shows the round counter and score", () => {
    render(<RpsBoard state={base} busy={false} onPick={() => {}} />);
    expect(screen.getByText(/Manche 1 \/ 3/)).toBeInTheDocument();
  });

  it("emits the picked move", async () => {
    const onPick = vi.fn();
    render(<RpsBoard state={base} busy={false} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: "Ciseaux" }));
    expect(onPick).toHaveBeenCalledWith("scissors");
  });

  it("lists played rounds and the last outcome", () => {
    const state: RpsState = {
      ...base,
      rounds: [
        { player: "rock", ai: "scissors", outcome: "win" },
        { player: "paper", ai: "paper", outcome: "draw" },
      ],
      player_score: 1,
    };
    render(<RpsBoard state={state} busy={false} onPick={() => {}} />);
    expect(screen.getByText(/Vous : Feuille\. IA : Feuille\. Manche nulle\./)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Historique des manches" }).children).toHaveLength(2);
    expect(screen.getByText(/Manche 3 \/ 3/)).toBeInTheDocument();
  });

  it("disables buttons when busy or finished", () => {
    const { rerender } = render(<RpsBoard state={base} busy={true} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "Pierre" })).toBeDisabled();
    rerender(
      <RpsBoard
        state={{ ...base, finished: true, legal_moves: [] }}
        busy={false}
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Pierre" })).toBeDisabled();
  });
});
