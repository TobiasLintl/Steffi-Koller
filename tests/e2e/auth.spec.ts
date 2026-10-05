import { expect, test, type Page } from "@playwright/test";

// Uses the fictional seed users (pnpm db:seed).
const PASSWORD = process.env.SEED_PASSWORD ?? "seelenzeit-dev-123";

async function login(page: Page, email: string, next = "/konto") {
  await page.goto(`/anmelden?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

test("visitors without session are sent to the login page", async ({ page }) => {
  await page.goto("/konto");
  await expect(page).toHaveURL(/\/anmelden\?next=%2Fkonto/);
});

test("customer signs in with password and reaches the account", async ({ page }) => {
  await login(page, "kundin@example.test");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hallo Klara Kundin!");
});

test("customer is kept out of the admin area", async ({ page }) => {
  await login(page, "kundin@example.test");
  await expect(page).toHaveURL(/\/konto$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/konto$/);
});

test("staff must set up two-factor authentication before using the admin area", async ({
  page,
}) => {
  await login(page, "support@example.test", "/admin");
  await expect(page).toHaveURL(/\/admin\/2fa-einrichten$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Zwei-Faktor-Anmeldung einrichten",
  );
});

test("wrong password shows a friendly error", async ({ page }) => {
  await page.goto("/anmelden");
  await page.getByLabel("E-Mail-Adresse").fill("kundin@example.test");
  await page.getByLabel("Passwort", { exact: true }).fill("falsch-falsch-falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
});
