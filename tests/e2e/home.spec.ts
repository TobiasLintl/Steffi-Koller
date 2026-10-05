import { expect, test } from "@playwright/test";

test("start page presents Seelenzeit in German", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Seelenzeit/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Zeit für dich. In deinem Tempo.",
  );
  await expect(page.getByRole("link", { name: /Achtsam durch den Tag/ })).toBeVisible();
});
