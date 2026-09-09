import { expect, type Page } from "@playwright/test";

/**
 * Ouvre une page et attend l'hydratation : le pseudo (ou « Invité ») remplace « … » dans la nav
 * une fois la session chargée. Interagir avant ce point fait perdre les saisies (React reprend
 * la main sur les champs contrôlés à l'hydratation).
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("navigation").getByText("…")).toHaveCount(0);
}
