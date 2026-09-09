import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { displayName, SessionProvider, useSession } from "@/lib/session";
import { ALICE, GUEST, http, HttpResponse, server } from "@/tests/msw/server";

function Probe() {
  const { player, loading, error, logout } = useSession();
  return (
    <div>
      <span data-testid="name">{loading ? "loading" : displayName(player)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe("SessionProvider", () => {
  it("uses the existing session when /me succeeds", async () => {
    server.use(http.get("*/api/auth/me", () => HttpResponse.json(ALICE)));
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId("name")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("alice"));
  });

  it("creates a guest when there is no session", async () => {
    let guestCalls = 0;
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({ detail: "not authenticated" }, { status: 401 }),
      ),
      http.post("*/api/auth/guest", () => {
        guestCalls += 1;
        return HttpResponse.json(GUEST);
      }),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Invité"));
    expect(guestCalls).toBe(1);
  });

  it("reports a server error", async () => {
    server.use(
      http.get("*/api/auth/me", () => HttpResponse.json({ detail: "boom" }, { status: 500 })),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Le serveur ne répond pas."),
    );
  });

  it("logout clears the session and opens a guest one", async () => {
    let loggedOut = false;
    server.use(
      http.get("*/api/auth/me", () =>
        loggedOut ? HttpResponse.json({ detail: "no" }, { status: 401 }) : HttpResponse.json(ALICE),
      ),
      http.post("*/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("alice"));
    await userEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Invité"));
  });

  it("useSession outside the provider throws", () => {
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
  });
});
