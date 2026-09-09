"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { GameResult } from "@/components/GameResult";
import { RpsBoard } from "@/components/rps/RpsBoard";
import { useWebGL } from "@/components/three/useWebGL";
import type { RpsState } from "@/lib/api";
import { useGame } from "@/lib/use-game";

const RpsScene = dynamic(() => import("@/components/three/RpsScene").then((m) => m.RpsScene), {
  ssr: false,
  loading: () => <div className="bg-surface h-72 w-full rounded-lg" />,
});

export default function RpsPage() {
  const { game, busy, error, start, play, reset } = useGame<RpsState>("rps");
  const [rounds, setRounds] = useState(5);
  const webgl = useWebGL();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pierre-feuille-ciseaux</h1>
      <p className="text-muted">
        La pierre bat les ciseaux, les ciseaux battent la feuille, la feuille bat la pierre.
      </p>

      {error && (
        <p role="alert" className="rounded-md border border-red-400 px-3 py-2 text-red-600">
          {error}
        </p>
      )}

      {game === null ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start("random", { rounds });
          }}
          className="border-border bg-surface space-y-4 rounded-lg border p-4"
        >
          <label className="block">
            <span className="text-muted text-sm">Nombre de manches (1 à 20)</span>
            <input
              type="number"
              min={1}
              max={20}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="border-border bg-background mt-1 block w-32 rounded-md border px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={busy || rounds < 1 || rounds > 20}
            className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium disabled:opacity-40"
          >
            Commencer
          </button>
        </form>
      ) : (
        <>
          {webgl && <RpsScene state={game.state} busy={busy} onPick={(move) => void play(move)} />}
          <RpsBoard state={game.state} busy={busy} onPick={(move) => void play(move)} />
          {game.result && <GameResult result={game.result} onReplay={reset} />}
        </>
      )}
    </div>
  );
}
