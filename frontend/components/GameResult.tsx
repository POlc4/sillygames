import type { Outcome } from "@/lib/api";

const LABELS: Record<Outcome, string> = {
  win: "Vous avez gagné !",
  loss: "L'IA a gagné.",
  draw: "Égalité.",
};

type Props = { result: Outcome; onReplay: () => void; children?: React.ReactNode };

export function GameResult({ result, onReplay, children }: Props) {
  return (
    <div role="status" className="border-border bg-surface space-y-3 rounded-lg border p-4">
      <p className="text-xl font-semibold">{LABELS[result]}</p>
      {children}
      <button
        type="button"
        onClick={onReplay}
        className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium"
      >
        Rejouer
      </button>
    </div>
  );
}
