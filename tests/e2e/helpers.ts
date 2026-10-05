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

// Fixed dev-only TOTP secrets of the seeded staff (src/server/db/seed.ts).
export const STAFF = {
  admin: { email: "admin@example.test", totp: "seelenzeit-dev-totp-secret-00001" },
  support: { email: "support@example.test", totp: "seelenzeit-dev-totp-secret-00002" },
  editor: { email: "redaktion@example.test", totp: "seelenzeit-dev-totp-secret-00003" },
  accounting: { email: "buchhaltung@example.test", totp: "seelenzeit-dev-totp-secret-00004" },
  report_approver: { email: "freigabe@example.test", totp: "seelenzeit-dev-totp-secret-00005" },
} as const;

export async function loginAdmin(page: Page, next = "/admin", who: keyof typeof STAFF = "admin") {
  const { totp } = await import("./totp");
  await page.goto(`/anmelden?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill(STAFF[who].email);
  await page.getByLabel("Passwort", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/anmelden\/zwei-faktor/);
  await page.getByLabel(/Code/).fill(totp(STAFF[who].totp));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}
