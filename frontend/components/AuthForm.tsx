"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

type Props = { mode: "login" | "register" };

const COPY = {
  login: { title: "Connexion", submit: "Se connecter" },
  register: { title: "Créer un compte", submit: "Créer mon compte" },
} as const;

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const { refresh } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await api.login(username, password);
      } else {
        await api.register(username, password);
      }
      await refresh();
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Identifiants incorrects.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("Ce pseudo est déjà pris.");
      } else if (err instanceof ApiError && err.status === 422) {
        setError(
          "Pseudo de 3 à 32 caractères (lettres, chiffres, . _ -), mot de passe de 8 au moins.",
        );
      } else {
        setError("Le serveur ne répond pas.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-surface max-w-sm space-y-4 rounded-lg border p-4"
    >
      <h1 className="text-2xl font-bold">{COPY[mode].title}</h1>
      {mode === "register" && (
        <p className="text-muted text-sm">
          Vos parties d&apos;invité seront rattachées à ce compte. Pas d&apos;e-mail, donc pas de
          récupération de mot de passe : notez-le.
        </p>
      )}
      <label className="block">
        <span className="text-muted text-sm">Pseudo</span>
        <input
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="border-border bg-background mt-1 block w-full rounded-md border px-2 py-1"
        />
      </label>
      <label className="block">
        <span className="text-muted text-sm">Mot de passe</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-border bg-background mt-1 block w-full rounded-md border px-2 py-1"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="bg-accent text-accent-foreground rounded-md px-4 py-2 font-medium disabled:opacity-40"
      >
        {COPY[mode].submit}
      </button>
    </form>
  );
}
