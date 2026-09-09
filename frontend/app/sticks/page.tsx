"use client";

import dynamic from "next/dynamic";

import { GameResult } from "@/components/GameResult";
import { SticksBoard } from "@/components/sticks/SticksBoard";
import { SticksSetup, type SticksOptions } from "@/components/sticks/SticksSetup";
import { useWebGL } from "@/components/three/useWebGL";
import type { SticksState } from "@/lib/api";
import { useGame } from "@/lib/use-game";

// La scène WebGL n'existe pas côté serveur : import dynamique sans SSR, fallback 2D sinon.
const SticksScene = dynamic(
  () => import("@/components/three/SticksScene").then((m) => m.SticksScene),
  { ssr: false, loading: () => <div className="bg-surface h-72 w-full rounded-lg" /> },
);

export default function SticksPage() {
  const { game, busy, error, start, play, reset } = useGame<SticksState>("sticks");
  const webgl = useWebGL();

  function onStart({ sticks, first, strategy }: SticksOptions) {
    void start(strategy, { sticks, first });
  }

  const lastMove = game?.moves.at(-1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bâtonnets</h1>
      <p className="text-muted">
        À tour de rôle, retirez 1, 2 ou 3 bâtonnets. Celui qui prend le dernier a perdu.
      </p>

      {error && (
        <p role="alert" className="rounded-md border border-red-400 px-3 py-2 text-red-600">
          {error}
        </p>
      )}

      {game === null ? (
        <SticksSetup busy={busy} onStart={onStart} />
      ) : (
        <>
          {webgl && (
            <SticksScene
              state={game.state}
              lastMove={lastMove}
              busy={busy}
              onTake={(n) => void play(n)}
            />
          )}
          <SticksBoard
            state={game.state}
            busy={busy}
            showSticks={!webgl}
            onTake={(n) => void play(n)}
          />

          {lastMove?.ai_move && !game.state.finished && (
            <p className="text-muted" aria-live="polite">
              L&apos;IA a retiré {lastMove.ai_move} bâtonnet{lastMove.ai_move !== "1" ? "s" : ""}.
            </p>
          )}

          {game.result && (
            <GameResult result={game.result} onReplay={reset}>
              {game.result === "loss" && (
                <p className="text-muted text-sm">
                  Astuce : laissez toujours à l&apos;adversaire un nombre de bâtonnets égal à 1, 5,
                  9, 13, 17 ou 21, puis complétez chacun de ses coups à 4.
                </p>
              )}
            </GameResult>
          )}
        </>
      )}
    </div>
  );
}
