"use client";

import { useState, type FormEvent } from "react";

import type { FirstPlayer } from "@/lib/api";

export type SticksOptions = { sticks: number; first: FirstPlayer; strategy: "random" | "perfect" };

type Props = { busy: boolean; onStart: (options: SticksOptions) => void };

export function SticksSetup({ busy, onStart }: Props) {
  const [sticks, setSticks] = useState(21);
  const [first, setFirst] = useState<FirstPlayer>("player");
  const [strategy, setStrategy] = useState<"random" | "perfect">("random");

  function submit(event: FormEvent) {
    event.preventDefault();
    onStart({ sticks, first, strategy });
  }

  return (
    <form onSubmit={submit} className="border-border bg-surface space-y-4 rounded-lg border p-4">
      <label className="block">
        <span className="text-muted text-sm">Nombre de bâtonnets (5 à 50)</span>
        <input
          type="number"
          min={5}
          max={50}
          value={sticks}
          onChange={(e) => setSticks(Number(e.target.value))}
          className="border-border bg-background mt-1 block w-32 rounded-md border px-2 py-1"
        />
      </label>

      <fieldset>
        <legend className="text-muted text-sm">Qui commence ?</legend>
        <div className="mt-1 flex gap-4">
          {(["player", "ai", "random"] as const).map((value) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="radio"
                name="first"
                value={value}
                checked={first === value}
                onChange={() => setFirst(value)}
              />
              {value === "player" ? "Moi" : value === "ai" ? "L'IA" : "Au hasard"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-muted text-sm">Adversaire</legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="strategy"
              value="random"
              checked={strategy === "random"}
              onChange={() => setStrategy("random")}
            />
            Aléatoire
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="strategy"
              value="perfect"
              checked={strategy === "perfect"}
              onChange={() => setStrategy("perfect")}
            />
            Expert
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={busy || sticks < 5 || sticks > 50}
        className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium disabled:opacity-40"
      >
        Commencer
      </button>
    </form>
  );
}
