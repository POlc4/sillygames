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

test("the site is installable: manifest, icons, service worker and offline page", async ({
  page,
}) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  for (const icon of body.icons) {
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  }
  const sw = await page.request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["content-type"]).toContain("javascript");

  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Hors ligne" })).toBeVisible();
  await page.goto("/");
  const registered = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) => r.active !== null),
  );
  expect(registered).toBe(true);
});
