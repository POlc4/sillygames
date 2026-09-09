import { expect, test, type Page } from "@playwright/test";

import { open } from "./helpers";

async function remainingSticks(page: Page): Promise<number> {
  const text = await page.locator("p[aria-live] strong").first().textContent();
  return Number(text);
}

function winningMove(sticks: number): number {
  const take = (sticks - 1) % 4;
  return take >= 1 && take <= 3 ? take : 1;
}

test("a player using the 4k+1 strategy beats the random AI", async ({ page }) => {
  await open(page, "/sticks");
  const count = page.getByLabel(/Nombre de bâtonnets/);
  await count.fill("10");
  await expect(count).toHaveValue("10");
  await page.getByLabel("Moi").check();
  await page.getByLabel("Aléatoire").check();
  await page.getByRole("button", { name: "Commencer" }).click();

  await expect(page.locator("p[aria-live] strong").first()).toHaveText("10");

  for (let turn = 0; turn < 10; turn++) {
    const status = page.getByRole("status");
    if (await status.isVisible()) break;
    const sticks = await remainingSticks(page);
    const take = winningMove(sticks);
    const button = page.getByRole("button", { name: `Retirer ${take}` });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.locator("p[aria-live] strong").first()).not.toHaveText(String(sticks));
  }

  await expect(page.getByRole("status")).toContainText("Vous avez gagné !");
  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.getByRole("button", { name: "Commencer" })).toBeVisible();
});

test("the expert AI wins when it plays second on 21 sticks", async ({ page }) => {
  await open(page, "/sticks");
  await page.getByLabel("Expert").check();
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page.locator("p[aria-live] strong").first()).toHaveText("21");

  for (let turn = 0; turn < 12; turn++) {
    if (await page.getByRole("status").isVisible()) break;
    const sticks = await remainingSticks(page);
    const take = Math.min(3, sticks);
    await page.getByRole("button", { name: `Retirer ${take}` }).click();
    await expect(page.locator("p[aria-live] strong").first()).not.toHaveText(String(sticks));
  }

  await expect(page.getByRole("status")).toContainText("L'IA a gagné.");
  await expect(page.getByText(/Astuce/)).toBeVisible();
});
