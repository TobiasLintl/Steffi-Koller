import { expect, test } from "@playwright/test";

import { login } from "./helpers";

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
  await login(page, "neu@example.test", "/admin");
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
