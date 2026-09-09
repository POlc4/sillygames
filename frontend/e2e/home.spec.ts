import { expect, test } from "@playwright/test";

test("home page opens a guest session and links to both games", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Deux petits jeux contre une IA" })).toBeVisible();
  await expect(page.getByRole("navigation").getByText("Invité")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /^Bâtonnets/ })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /^Pierre-feuille-ciseaux/ }),
  ).toBeVisible();

  const health = await page.request.get("/api/health");
  expect(await health.json()).toEqual({ status: "ok", database: "ok" });
});
