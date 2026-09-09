// Parties jouées localement (hors ligne) avec les moteurs TypeScript, dans la même forme que
// les réponses de l'API : les pages et les plateaux ne font pas la différence.

import type { Game, GameType, RpsMove, RpsState, SticksState } from "@/lib/api";
import { RPS_STRATEGIES, STICKS_STRATEGIES } from "@/lib/engines/ai";
import { seeded, type Rng } from "@/lib/engines/rng";
import * as rps from "@/lib/engines/rps";
import * as sticks from "@/lib/engines/sticks";

export const LOCAL_PREFIX = "local:";

export function isLocalGame(game: Pick<Game, "id">): boolean {
  return game.id.startsWith(LOCAL_PREFIX);
}

function localId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${LOCAL_PREFIX}${random}`;
}

function defaultRng(): Rng {
  return seeded(Math.floor(Math.random() * 2 ** 31));
}

function finish<S extends SticksState | RpsState>(game: Game<S>, result: Game["result"]): Game<S> {
  if (result === null) return game;
  return { ...game, status: "finished", result, finished_at: new Date().toISOString() };
}

export function createLocalGame<S extends SticksState | RpsState>(
  gameType: GameType,
  aiStrategy: string,
  config: Record<string, unknown>,
  rng: Rng = defaultRng(),
): Game<S> {
  const now = new Date().toISOString();
  const base = {
    id: localId(),
    game_type: gameType,
    ai_strategy: aiStrategy,
    status: "in_progress" as const,
    result: null,
    started_at: now,
    finished_at: null,
    moves: [],
  };

  if (gameType === "sticks") {
    const count = Number(config.sticks ?? sticks.DEFAULT_STICKS);
    const wanted = String(config.first ?? "player");
    const first =
      wanted === "random" ? (rng() < 0.5 ? "player" : "ai") : (wanted as "player" | "ai");
    let state = sticks.newGame(count, first);
    const game: Game<SticksState> = { ...base, config: { sticks: count, first }, state };
    if (first === "ai") {
      const take = STICKS_STRATEGIES[aiStrategy](rng)(state);
      const before = state;
      state = sticks.apply(state, take);
      game.moves.push({
        turn: 0,
        player_move: null,
        ai_move: String(take),
        state_before: before,
        state_after: state,
        created_at: now,
      });
      game.state = state;
    }
    return game as Game<S>;
  }

  const rounds = Number(config.rounds ?? rps.DEFAULT_ROUNDS);
  const game: Game<RpsState> = { ...base, config: { rounds }, state: rps.newGame(rounds) };
  return game as Game<S>;
}

export function playLocal<S extends SticksState | RpsState>(
  game: Game<S>,
  move: number | string,
  rng: Rng = defaultRng(),
): Game<S> {
  if (game.status !== "in_progress") throw new sticks.IllegalMoveError("game is finished");
  const now = new Date().toISOString();
  const turn = game.moves.length ? game.moves[game.moves.length - 1].turn + 1 : 1;

  if (game.game_type === "sticks") {
    const before = game.state as SticksState;
    if (typeof move !== "number") throw new sticks.IllegalMoveError("move must be a number");
    let state = sticks.apply(before, move);
    let aiMove: string | null = null;
    if (!state.finished) {
      const take = STICKS_STRATEGIES[game.ai_strategy](rng)(state);
      aiMove = String(take);
      state = sticks.apply(state, take);
    }
    const next: Game<SticksState> = {
      ...(game as Game<SticksState>),
      state,
      moves: [
        ...game.moves,
        {
          turn,
          player_move: String(move),
          ai_move: aiMove,
          state_before: before,
          state_after: state,
          created_at: now,
        },
      ],
    };
    return finish(
      next,
      state.winner === null ? null : state.winner === "player" ? "win" : "loss",
    ) as Game<S>;
  }

  const before = game.state as RpsState;
  if (!rps.MOVES.includes(move as RpsMove)) throw new sticks.IllegalMoveError("invalid move");
  const aiMove = RPS_STRATEGIES[game.ai_strategy](rng)(before);
  const state = rps.playRound(before, move as RpsMove, aiMove);
  const next: Game<RpsState> = {
    ...(game as Game<RpsState>),
    state,
    moves: [
      ...game.moves,
      {
        turn,
        player_move: move as string,
        ai_move: aiMove,
        state_before: before,
        state_after: state,
        created_at: now,
      },
    ],
  };
  return finish(next, rps.result(state)) as Game<S>;
}
