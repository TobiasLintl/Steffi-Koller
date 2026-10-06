import { expect, test } from "@playwright/test";

import { loginAdmin } from "./helpers";

test("admin signs in with password + TOTP and sees all areas", async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hallo Ada Admin");
  const nav = page.getByRole("navigation", { name: "Adminnavigation" });
  for (const label of ["Kunden", "Käufe", "Produkte", "Webhooks", "Einstellungen"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("admin finds a customer and sees her access", async ({ page }) => {
  await loginAdmin(page, "/admin/kunden");
  await page.getByLabel("Kunden suchen").fill("klara");
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByRole("link", { name: "Klara Kundin" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Klara Kundin");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Achtsam durch den Tag (Beispielkurs)" }).first(),
  ).toBeVisible();
});

test("product mappings and webhook URLs are visible to the admin", async ({ page }) => {
  await loginAdmin(page, "/admin/produkte");
  await expect(page.getByText("copecart: cc-achtsam-durch-den-tag", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Achtsam durch den Tag", exact: true }).click();
  await expect(page.getByLabel("Zugangsdauer in Monaten")).toHaveValue("6");
  await page.goto("/admin/einstellungen");
  await expect(page.getByText(/\/api\/webhooks\/copecart/)).toBeVisible();
});
