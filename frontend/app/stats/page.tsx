"use client";

import { useEffect, useState } from "react";

import {
  api,
  type GlobalStats,
  type LeaderboardEntry,
  type PlayerStats,
  type StatLine,
} from "@/lib/api";
import { useSession } from "@/lib/session";

const GAME_LABELS = { sticks: "Bâtonnets", rps: "Pierre-feuille-ciseaux" } as const;
const STRATEGY_LABELS: Record<string, string> = {
  random: "aléatoire",
  perfect: "expert",
  ml: "ML",
};

function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

function StatTable({ lines }: { lines: StatLine[] }) {
  if (lines.length === 0) {
    return <p className="text-muted">Aucune partie terminée pour l&apos;instant.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pr-4">Jeu</th>
            <th className="py-1 pr-4">IA</th>
            <th className="py-1 pr-4">Parties</th>
            <th className="py-1 pr-4">Victoires</th>
            <th className="py-1 pr-4">Défaites</th>
            <th className="py-1 pr-4">Nuls</th>
            <th className="py-1">Taux</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.game_type}-${line.ai_strategy}`} className="border-border border-t">
              <td className="py-1 pr-4">{GAME_LABELS[line.game_type]}</td>
              <td className="py-1 pr-4">{STRATEGY_LABELS[line.ai_strategy] ?? line.ai_strategy}</td>
              <td className="py-1 pr-4">{line.games}</td>
              <td className="py-1 pr-4">{line.wins}</td>
              <td className="py-1 pr-4">{line.losses}</td>
              <td className="py-1 pr-4">{line.draws}</td>
              <td className="py-1">{percent(line.win_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatsPage() {
  const { player } = useSession();
  const [mine, setMine] = useState<PlayerStats | null>(null);
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player === null) return;
    Promise.all([api.statsMe(), api.statsGlobal(), api.leaderboard()])
      .then(([me, all, top]) => {
        setMine(me);
        setGlobal(all);
        setBoard(top);
      })
      .catch(() => setError("Impossible de charger les statistiques."));
  }, [player]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Statistiques</h1>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Mes parties</h2>
        {mine ? (
          <>
            <p className="text-muted">
              {mine.games} partie{mine.games > 1 ? "s" : ""} terminée{mine.games > 1 ? "s" : ""},{" "}
              {mine.wins} victoire{mine.wins > 1 ? "s" : ""}.
            </p>
            <StatTable lines={mine.lines} />
          </>
        ) : (
          <p className="text-muted">Chargement…</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Tous les joueurs</h2>
        {global ? (
          <>
            <p className="text-muted">
              {global.players} joueur{global.players > 1 ? "s" : ""}, {global.games} partie
              {global.games > 1 ? "s" : ""} terminée{global.games > 1 ? "s" : ""}.
            </p>
            <StatTable lines={global.lines} />
          </>
        ) : (
          <p className="text-muted">Chargement…</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Classement</h2>
        {board === null ? (
          <p className="text-muted">Chargement…</p>
        ) : board.length === 0 ? (
          <p className="text-muted">Aucun joueur inscrit n&apos;a terminé de partie.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-6">
            {board.map((entry) => (
              <li key={entry.username}>
                <strong>{entry.username}</strong> : {entry.wins} victoire{entry.wins > 1 ? "s" : ""}{" "}
                sur {entry.games} ({percent(entry.win_rate)})
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
