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

// Fixed dev-only TOTP secret of the seeded admin (src/server/db/seed.ts).
const DEV_ADMIN_TOTP_SECRET = "seelenzeit-dev-totp-secret-00001";

export async function loginAdmin(page: Page, next = "/admin") {
  const { totp } = await import("./totp");
  await page.goto(`/anmelden?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill("admin@example.test");
  await page.getByLabel("Passwort", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/anmelden\/zwei-faktor/);
  await page.getByLabel(/Code/).fill(totp(DEV_ADMIN_TOTP_SECRET));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}
