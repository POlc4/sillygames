import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import AccountPage from "@/app/account/page";
import { SessionProvider } from "@/lib/session";
import { ALICE, http, HttpResponse, server } from "@/tests/msw/server";

const GITHUB = {
  id: "id-1",
  provider: "github",
  email: "octo@example.com",
  display_name: "octocat",
  created_at: "2026-09-10T00:00:00Z",
};
const GOOGLE = { ...GITHUB, id: "id-2", provider: "google", email: "octo@gmail.example" };

function renderPage() {
  return render(
    <SessionProvider>
      <AccountPage />
    </SessionProvider>,
  );
}

describe("Account page", () => {
  it("invites guests to create an account", async () => {
    server.use(http.get("*/api/auth/providers", () => HttpResponse.json([])));
    renderPage();
    expect(await screen.findByText(/Vous jouez en invité/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer un compte" })).toBeInTheDocument();
  });

  it("lists linked identities and unlinks one", async () => {
    let identities = [GITHUB, GOOGLE];
    server.use(
      http.get("*/api/auth/me", () => HttpResponse.json(ALICE)),
      http.get("*/api/auth/providers", () =>
        HttpResponse.json([{ name: "github", label: "GitHub" }]),
      ),
      http.get("*/api/auth/identities", () => HttpResponse.json(identities)),
      http.delete("*/api/auth/identities/id-2", () => {
        identities = [GITHUB];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();
    expect(await screen.findByRole("heading", { name: "Compte de alice" })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Identités liées" });
    expect(list.children).toHaveLength(2);
    expect(screen.getByText(/octo@gmail\.example/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Délier Google" }));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Identités liées" }).children).toHaveLength(1),
    );
    expect(screen.getByText("Lier un fournisseur")).toBeInTheDocument();
  });

  it("explains why the last sign-in method cannot be removed", async () => {
    server.use(
      http.get("*/api/auth/me", () => HttpResponse.json(ALICE)),
      http.get("*/api/auth/providers", () => HttpResponse.json([])),
      http.get("*/api/auth/identities", () => HttpResponse.json([GITHUB])),
      http.delete("*/api/auth/identities/id-1", () =>
        HttpResponse.json({ detail: "last" }, { status: 409 }),
      ),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Délier GitHub" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/seule façon de vous connecter/);
  });
});
