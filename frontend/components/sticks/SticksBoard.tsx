"use client";

// Plateau 2D des bâtonnets. Reçoit l'état, émet une intention (onTake). Aucune règle ici.

import type { SticksState } from "@/lib/api";

type Props = {
  state: SticksState;
  busy: boolean;
  onTake: (count: number) => void;
};

export function SticksBoard({ state, busy, onTake }: Props) {
  const canPlay = !state.finished && !busy && state.current === "player";

  return (
    <div className="space-y-6">
      <div
        role="img"
        aria-label={`${state.sticks} bâtonnets restants`}
        className="border-border bg-surface flex flex-wrap gap-2 rounded-lg border p-4"
      >
        {Array.from({ length: state.sticks }, (_, i) => (
          <span
            key={i}
            data-testid="stick"
            className="bg-accent h-12 w-2 rounded-sm"
            style={{ transform: `rotate(${((i * 7) % 5) - 2}deg)` }}
          />
        ))}
        {state.sticks === 0 && <span className="text-muted">Plus aucun bâtonnet.</span>}
      </div>

      <p className="text-lg" aria-live="polite">
        <strong>{state.sticks}</strong> bâtonnet{state.sticks > 1 ? "s" : ""} restant
        {state.sticks > 1 ? "s" : ""}.
      </p>

      <div className="flex gap-3">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            disabled={!canPlay || !state.legal_moves.includes(n)}
            onClick={() => onTake(n)}
            className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium disabled:opacity-40"
          >
            Retirer {n}
          </button>
        ))}
      </div>
    </div>
  );
}
