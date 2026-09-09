import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SticksBoard } from "@/components/sticks/SticksBoard";
import type { SticksState } from "@/lib/api";

const base: SticksState = {
  sticks: 7,
  current: "player",
  winner: null,
  legal_moves: [1, 2, 3],
  finished: false,
};

describe("SticksBoard", () => {
  it("draws one stick per remaining stick", () => {
    render(<SticksBoard state={base} busy={false} onTake={() => {}} />);
    expect(screen.getAllByTestId("stick")).toHaveLength(7);
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it("emits the chosen count", async () => {
    const onTake = vi.fn();
    render(<SticksBoard state={base} busy={false} onTake={onTake} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirer 2" }));
    expect(onTake).toHaveBeenCalledWith(2);
  });

  it("disables moves that are not legal", () => {
    render(
      <SticksBoard
        state={{ ...base, sticks: 2, legal_moves: [1, 2] }}
        busy={false}
        onTake={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Retirer 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retirer 2" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retirer 3" })).toBeDisabled();
  });

  it("disables everything while busy or when finished", () => {
    const { rerender } = render(<SticksBoard state={base} busy={true} onTake={() => {}} />);
    expect(screen.getByRole("button", { name: "Retirer 1" })).toBeDisabled();
    rerender(
      <SticksBoard
        state={{ ...base, sticks: 0, finished: true, winner: "ai", legal_moves: [] }}
        busy={false}
        onTake={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Retirer 1" })).toBeDisabled();
    expect(screen.getByText("Plus aucun bâtonnet.")).toBeInTheDocument();
  });
});
