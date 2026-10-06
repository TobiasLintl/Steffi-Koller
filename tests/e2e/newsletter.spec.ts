import { expect, test } from "@playwright/test";

test("newsletter sign-up requires consent and asks for confirmation (DOI)", async ({ page }) => {
  await page.goto("/newsletter");
  await page.getByLabel("E-Mail-Adresse für den Newsletter").fill(`e2e-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Anmelden" }).click();
  // Browser validation blocks submit without the consent checkbox.
  await expect(page.getByText("Fast geschafft!")).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText(/Fast geschafft! Bitte bestätige deine Anmeldung/)).toBeVisible();
});

test("confirmation links need an explicit click (no auto-confirm by mail scanners)", async ({
  page,
}) => {
  await page.goto("/newsletter/bestaetigen?token=invalid-token-1234567890");
  await expect(page.getByRole("button", { name: "Anmeldung bestätigen" })).toBeVisible();
  await page.getByRole("button", { name: "Anmeldung bestätigen" }).click();
  await expect(page.getByText(/ungültig oder abgelaufen/)).toBeVisible();
});
