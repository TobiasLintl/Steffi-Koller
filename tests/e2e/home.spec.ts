import { expect, test } from "@playwright/test";

test("start page greets the visitor in German", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Seelenzeit/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Schön, dass du da bist.");
});
