import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OAuthButtons } from "@/components/OAuthButtons";
import { http, HttpResponse, server } from "@/tests/msw/server";

describe("OAuthButtons", () => {
  it("renders one link per enabled provider, pointing at the start route", async () => {
    server.use(
      http.get("*/api/auth/providers", () =>
        HttpResponse.json([
          { name: "github", label: "GitHub" },
          { name: "google", label: "Google" },
        ]),
      ),
    );
    render(<OAuthButtons returnTo="/stats" />);
    const github = await screen.findByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", "/api/auth/oauth/github/start?return_to=%2Fstats");
    expect(screen.getByRole("link", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByText("Ou continuer avec")).toBeInTheDocument();
  });

  it("renders nothing when no provider is configured", async () => {
    server.use(http.get("*/api/auth/providers", () => HttpResponse.json([])));
    const { container } = render(<OAuthButtons />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing when the request fails", async () => {
    server.use(http.get("*/api/auth/providers", () => HttpResponse.json({}, { status: 500 })));
    const { container } = render(<OAuthButtons />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
