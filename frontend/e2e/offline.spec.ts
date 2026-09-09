import { expect, test } from "@playwright/test";

import { open } from "./helpers";

test("a game played offline is synced and counted once the network is back", async ({
  page,
  context,
}) => {
  await open(page, "/rps");
  await context.setOffline(true);

  await page.getByLabel(/Nombre de manches/).fill("1");
  await page.getByRole("button", { name: "Commencer" }).click();
  const banner = page.getByRole("status").filter({ hasText: /hors ligne/i });
  await expect(banner).toBeVisible();

  await page.getByRole("button", { name: "Pierre" }).click();
  await expect(page.getByRole("status").filter({ hasText: /gagné|Égalité/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Synchroniser" })).toBeVisible();

  // Retour du réseau : l'événement online déclenche la synchronisation, le bandeau disparaît.
  await context.setOffline(false);
  await expect(banner).toHaveCount(0, { timeout: 15000 });

  await open(page, "/stats");
  await expect(page.getByText("1 partie terminée, ")).toBeVisible();
});
