"use client";

// Session joueur : à l'ouverture, récupère le joueur courant ou crée un invité (ADR 0003).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { api, ApiError, type Player } from "@/lib/api";

type Session = {
  player: Player | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

type Loaded = { player: Player | null; error: string | null };

const SessionContext = createContext<Session | null>(null);

// Fonction pure (hors composant) : l'effet ne fait que la lancer et appliquer son résultat,
// ce qu'exige la règle react-hooks/set-state-in-effect.
export async function loadSession(): Promise<Loaded> {
  try {
    return { player: await api.me(), error: null };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      try {
        return { player: await api.guest(), error: null };
      } catch {
        return { player: null, error: "Impossible de démarrer une session." };
      }
    }
    return { player: null, error: "Le serveur ne répond pas." };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Loaded & { loading: boolean }>({
    player: null,
    error: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    const loaded = await loadSession();
    setState({ ...loaded, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    loadSession().then((loaded) => {
      if (active) setState({ ...loaded, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ ...state, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return session;
}

export function displayName(player: Player | null): string {
  if (player === null) return "…";
  return player.is_guest || player.username === null ? "Invité" : player.username;
}
