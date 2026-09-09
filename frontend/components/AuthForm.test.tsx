import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/AuthForm";
import { SessionProvider } from "@/lib/session";
import { ALICE, http, HttpResponse, server } from "@/tests/msw/server";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

async function fill(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Pseudo"), username);
  await user.type(screen.getByLabelText("Mot de passe"), password);
  return user;
}

describe("AuthForm", () => {
  it("registers, refreshes the session and goes home", async () => {
    let body: unknown = null;
    server.use(
      http.post("*/api/auth/register", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ALICE, { status: 201 });
      }),
      http.get("*/api/auth/me", () => HttpResponse.json(ALICE)),
    );
    render(
      <SessionProvider>
        <AuthForm mode="register" />
      </SessionProvider>,
    );
    const user = await fill("alice", "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(body).toEqual({ username: "alice", password: "correct-horse-battery" });
  });

  it("explains a rejected login", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ detail: "invalid credentials" }, { status: 401 }),
      ),
    );
    render(
      <SessionProvider>
        <AuthForm mode="login" />
      </SessionProvider>,
    );
    const user = await fill("alice", "wrong-password");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiants incorrects.");
  });

  it("explains a taken username and validation errors", async () => {
    server.use(
      http.post("*/api/auth/register", () =>
        HttpResponse.json({ detail: "username already taken" }, { status: 409 }),
      ),
    );
    render(
      <SessionProvider>
        <AuthForm mode="register" />
      </SessionProvider>,
    );
    const user = await fill("alice", "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce pseudo est déjà pris.");

    server.use(
      http.post("*/api/auth/register", () => HttpResponse.json({ detail: [] }, { status: 422 })),
    );
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Pseudo de 3 à 32/));
  });
});

describe("AuthForm with OAuth", () => {
  it("shows the OAuth failure reason coming back from the backend", async () => {
    search = "error=oauth&reason=state+mismatch";
    render(
      <SessionProvider>
        <AuthForm mode="login" />
      </SessionProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("state mismatch");
    search = "";
  });

  it("offers the enabled providers under the form", async () => {
    server.use(
      http.get("*/api/auth/providers", () =>
        HttpResponse.json([{ name: "github", label: "GitHub" }]),
      ),
    );
    render(
      <SessionProvider>
        <AuthForm mode="register" />
      </SessionProvider>,
    );
    expect(await screen.findByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "/api/auth/oauth/github/start?return_to=%2F",
    );
  });
});
