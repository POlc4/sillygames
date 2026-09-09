import { expect, test } from "@playwright/test";

test("guest games follow the player into a new account, stats and leaderboard", async ({
  page,
}) => {
  const username = `e2e_${Date.now().toString(36)}`;

  // Une manche de pierre-feuille-ciseaux en invité.
  await page.goto("/rps");
  await page.getByLabel(/Nombre de manches/).fill("1");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: "Pierre" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  // Inscription : l'historique de l'invité est conservé.
  await page.goto("/register");
  await page.getByLabel("Pseudo").fill(username);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("navigation").getByText(username)).toBeVisible();

  await page.goto("/stats");
  await expect(page.getByText("1 partie terminée, ")).toBeVisible();
  await expect(page.getByRole("list").getByText(username)).toBeVisible();

  // Déconnexion puis reconnexion.
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page.getByRole("navigation").getByText("Invité")).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Pseudo").fill(username);
  await page.getByLabel("Mot de passe").fill("wrong-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Identifiants incorrects.");

  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation").getByText(username)).toBeVisible();
});
