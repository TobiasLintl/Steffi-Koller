import { expect, type Page } from "@playwright/test";

// Fictional seed users (pnpm db:seed).
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "seelenzeit-dev-123";

export async function login(page: Page, email: string, next = "/konto") {
  await page.goto(`/anmelden?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/anmelden/);
}
