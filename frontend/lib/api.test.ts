import { describe, expect, it } from "vitest";

import { api, ApiError } from "@/lib/api";
import { GUEST, http, HttpResponse, server } from "@/tests/msw/server";

describe("api client", () => {
  it("returns the parsed body on success", async () => {
    expect(await api.me()).toEqual(GUEST);
  });

  it("sends JSON bodies with credentials", async () => {
    let received: unknown = null;
    let credentials: RequestCredentials | undefined;
    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        received = await request.json();
        credentials = request.credentials;
        return HttpResponse.json(GUEST);
      }),
    );
    await api.login("alice", "secret-password");
    expect(received).toEqual({ username: "alice", password: "secret-password" });
    expect(credentials).toBe("include");
  });

  it("throws ApiError with the backend detail on failure", async () => {
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({ detail: "not authenticated" }, { status: 401 }),
      ),
    );
    const error = await api.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("not authenticated");
  });

  it("handles 204 responses without a body", async () => {
    await expect(api.logout()).resolves.toBeUndefined();
  });

  it("keeps structured validation details", async () => {
    server.use(
      http.post("*/api/games", () =>
        HttpResponse.json({ detail: [{ msg: "bad" }] }, { status: 422 }),
      ),
    );
    const error = (await api
      .createGame("sticks", "random", {})
      .catch((e: unknown) => e)) as ApiError;
    expect(error.detail).toEqual([{ msg: "bad" }]);
    expect(error.message).toBe("HTTP 422");
  });
});
