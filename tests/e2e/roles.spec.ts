import { expect, test } from "@playwright/test";

import { loginAdmin, STAFF } from "./helpers";

/**
 * AK-12: each role reaches exactly its admin areas; everything else is refused server-side
 * (redirect to "Kein Zugriff"), not just hidden in the navigation.
 */
const AREAS = [
  "/admin/kennzahlen",
  "/admin/kunden",
  "/admin/kaeufe",
  "/admin/produkte",
  "/admin/kurse",
  "/admin/medien",
  "/admin/gutscheine",
  "/admin/inhalte",
  "/admin/nachrichten",
  "/admin/newsletter",
  "/admin/mitarbeiter",
  "/admin/auditlog",
  "/admin/export",
  "/admin/backups",
  "/admin/webhooks",
  "/admin/einstellungen",
] as const;

const ALLOWED: Record<keyof typeof STAFF, readonly string[]> = {
  admin: AREAS,
  support: ["/admin/kunden", "/admin/nachrichten", "/admin/newsletter"],
  editor: ["/admin/kurse", "/admin/medien", "/admin/inhalte"],
  accounting: ["/admin/kennzahlen", "/admin/kaeufe", "/admin/export"],
  report_approver: [],
};

for (const role of Object.keys(ALLOWED) as (keyof typeof STAFF)[]) {
  test(`role ${role} sees only its areas`, async ({ page }) => {
    test.setTimeout(90_000);
    await loginAdmin(page, "/admin", role);
    for (const area of AREAS) {
      await page.goto(area);
      if (ALLOWED[role].includes(area)) {
        await expect(page, `${role} → ${area}`).toHaveURL(new RegExp(`${area}$`));
      } else {
        await expect(page, `${role} ✗ ${area}`).toHaveURL(/\/admin\/kein-zugriff$/);
      }
    }
    const nav = page.getByRole("navigation", { name: "Adminnavigation" });
    await page.goto("/admin");
    expect(await nav.getByRole("link").count()).toBe(ALLOWED[role].length + 1);
  });
}

test("a customer account cannot open any admin area", async ({ page }) => {
  const { login } = await import("./helpers");
  await login(page, "kundin@example.test");
  for (const area of ["/admin/kunden", "/admin/kaeufe", "/admin/einstellungen"]) {
    await page.goto(area);
    await expect(page).toHaveURL(/\/konto$/);
  }
});
