// Client HTTP typé de l'API SillyGames. Les types reflètent backend/app/schemas.py.

export type Player = {
  id: string;
  username: string | null;
  is_guest: boolean;
  created_at: string;
};

export type GameType = "sticks" | "rps";
export type Outcome = "win" | "loss" | "draw";
export type FirstPlayer = "player" | "ai" | "random";

export type SticksState = {
  sticks: number;
  current: "player" | "ai";
  winner: "player" | "ai" | null;
  legal_moves: number[];
  finished: boolean;
};

export type RpsMove = "rock" | "paper" | "scissors";

export type RpsRound = { player: RpsMove; ai: RpsMove; outcome: Outcome };

export type RpsState = {
  total_rounds: number;
  rounds: RpsRound[];
  player_score: number;
  ai_score: number;
  finished: boolean;
  legal_moves: RpsMove[];
};

export type Move = {
  turn: number;
  player_move: string | null;
  ai_move: string | null;
  state_before: SticksState | RpsState;
  state_after: SticksState | RpsState;
  created_at: string;
};

export type GameSummary = {
  id: string;
  game_type: GameType;
  ai_strategy: string;
  config: Record<string, unknown>;
  status: "in_progress" | "finished";
  result: Outcome | null;
  started_at: string;
  finished_at: string | null;
};

export type Game<S = SticksState | RpsState> = GameSummary & { state: S; moves: Move[] };

export type StatLine = {
  game_type: GameType;
  ai_strategy: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
};

export type Provider = { name: string; label: string };

export type Identity = {
  id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

export type PlayerStats = { lines: StatLine[]; games: number; wins: number };
export type GlobalStats = PlayerStats & { players: number };
export type LeaderboardEntry = { username: string; games: number; wins: number; win_rate: number };

/** URL de départ du flux OAuth : une navigation complète, pas un fetch (redirections + cookies). */
export function oauthStartUrl(provider: string, returnTo = "/"): string {
  return `/api/auth/oauth/${provider}/start?return_to=${encodeURIComponent(returnTo)}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
    this.name = "ApiError";
  }
}

// En navigateur, appels relatifs à l'origine courante (Caddy ou le proxy de dev).
function baseUrl(): string {
  return typeof window === "undefined" ? (process.env.API_URL ?? "http://localhost:8000") : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl()}/api${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.detail ?? payload);
  }
  return payload as T;
}

export const api = {
  guest: () => request<Player>("POST", "/auth/guest"),
  me: () => request<Player>("GET", "/auth/me"),
  register: (username: string, password: string) =>
    request<Player>("POST", "/auth/register", { username, password }),
  login: (username: string, password: string) =>
    request<Player>("POST", "/auth/login", { username, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  providers: () => request<Provider[]>("GET", "/auth/providers"),
  identities: () => request<Identity[]>("GET", "/auth/identities"),
  unlinkIdentity: (id: string) => request<void>("DELETE", `/auth/identities/${id}`),

  createGame: <S>(game_type: GameType, ai_strategy: string, config: Record<string, unknown>) =>
    request<Game<S>>("POST", "/games", { game_type, ai_strategy, config }),
  playMove: <S>(gameId: string, move: number | string) =>
    request<Game<S>>("POST", `/games/${gameId}/moves`, { move }),
  getGame: <S>(gameId: string) => request<Game<S>>("GET", `/games/${gameId}`),
  importGame: <S>(body: {
    game_type: GameType;
    ai_strategy: string;
    config: Record<string, unknown>;
    turns: { player_move: number | string | null; ai_move: number | string | null }[];
    started_at?: string;
    finished_at?: string;
  }) => request<Game<S>>("POST", "/games/import", body),
  listGames: () => request<GameSummary[]>("GET", "/games"),

  statsMe: () => request<PlayerStats>("GET", "/stats/me"),
  statsGlobal: () => request<GlobalStats>("GET", "/stats/global"),
  leaderboard: () => request<LeaderboardEntry[]>("GET", "/stats/leaderboard"),
};
