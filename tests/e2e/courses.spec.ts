import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("my courses show active and expired access", async ({ page }) => {
  await login(page, "kundin@example.test");
  const active = page.getByRole("listitem").filter({ hasText: "Achtsam durch den Tag" });
  await expect(active.getByText("Aktiv")).toBeVisible();
  const expired = page.getByRole("listitem").filter({ hasText: "Selbstliebe in acht Schritten" });
  await expect(expired.getByText("Abgelaufen", { exact: true })).toBeVisible();
  await expect(expired.getByRole("link", { name: "Zugang verlängern" })).toHaveAttribute(
    "href",
    /copecart/,
  );
});

test("customer opens a lesson of a purchased course", async ({ page }) => {
  await login(page, "kundin@example.test");
  await page.goto("/konto/kurse/achtsam-durch-den-tag");
  await page.getByRole("link", { name: "Willkommen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Willkommen");
  await expect(page.getByText("fiktiver Beispieltext")).toBeVisible();
});

test("AK-07: courses without purchase are not reachable", async ({ page, browser }) => {
  // Urs owns "Der Jahresweg": take a real lesson URL from his account.
  const ursContext = await browser.newContext();
  const urs = await ursContext.newPage();
  await login(urs, "kunde.ch@example.test");
  await urs.goto("/konto/kurse/jahresweg");
  const lessonHref = await urs
    .getByRole("link", { name: "Einführung Monat 1" })
    .getAttribute("href");
  await expect(urs.getByText(/ab \d/).first()).toBeVisible(); // later months are drip-locked
  await ursContext.close();
  expect(lessonHref).toBeTruthy();

  await login(page, "kundin@example.test");
  const coursePage = await page.goto("/konto/kurse/jahresweg");
  expect(coursePage?.status()).toBe(404);
  const lessonPage = await page.goto(lessonHref!);
  expect(lessonPage?.status()).toBe(404);
  await expect(page.getByText("Geheimer Inhalt")).toHaveCount(0);
});
