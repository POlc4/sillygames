"use client";

// Plateau 2D pierre-feuille-ciseaux. Reçoit l'état, émet une intention (onPick).

import type { RpsMove, RpsState } from "@/lib/api";

export const MOVE_LABELS: Record<RpsMove, string> = {
  rock: "Pierre",
  paper: "Feuille",
  scissors: "Ciseaux",
};

const OUTCOME_LABELS = { win: "gagnée", loss: "perdue", draw: "nulle" } as const;

type Props = { state: RpsState; busy: boolean; onPick: (move: RpsMove) => void };

export function RpsBoard({ state, busy, onPick }: Props) {
  const canPlay = !state.finished && !busy;
  const last = state.rounds.at(-1);

  return (
    <div className="space-y-6">
      <p className="text-lg" aria-live="polite">
        Manche {Math.min(state.rounds.length + 1, state.total_rounds)} / {state.total_rounds}. Score
        : <strong>{state.player_score}</strong> à <strong>{state.ai_score}</strong>.
      </p>

      <div className="flex gap-3">
        {(["rock", "paper", "scissors"] as const).map((move) => (
          <button
            key={move}
            type="button"
            disabled={!canPlay}
            onClick={() => onPick(move)}
            className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium disabled:opacity-40"
          >
            {MOVE_LABELS[move]}
          </button>
        ))}
      </div>

      {last && (
        <p className="text-muted" aria-live="polite">
          Vous : {MOVE_LABELS[last.player]}. IA : {MOVE_LABELS[last.ai]}. Manche{" "}
          {OUTCOME_LABELS[last.outcome]}.
        </p>
      )}

      {state.rounds.length > 0 && (
        <ol className="text-muted space-y-1 text-sm" aria-label="Historique des manches">
          {state.rounds.map((round, i) => (
            <li key={i}>
              {i + 1}. {MOVE_LABELS[round.player]} contre {MOVE_LABELS[round.ai]} :{" "}
              {OUTCOME_LABELS[round.outcome]}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
