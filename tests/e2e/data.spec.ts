import { expect, test } from "@playwright/test";

import { login, loginAdmin } from "./helpers";

test("customer downloads her data (Art. 15)", async ({ page }) => {
  await login(page, "kundin@example.test", "/konto/daten");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Meine Daten herunterladen" }).click();
  const file = await download;
  const content = JSON.parse(
    await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()),
  );
  expect(content.account.email).toBe("kundin@example.test");
  expect(content.courseAccess.length).toBeGreaterThan(0);
});

test("AK-13: admin exports customers as CSV and orders as JSON", async ({ page }) => {
  await loginAdmin(page, "/admin/export");
  const csv = await page.request.get("/api/admin/export?dataset=customers&format=csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-disposition"]).toContain("seelenzeit-customers-");
  expect(await csv.text()).toContain("kundin@example.test");
  const json = await page.request.get("/api/admin/export?dataset=orders&format=json");
  expect((await json.json()).dataset).toBe("orders");
});

test("exports are refused without permission", async ({ page, request }) => {
  expect((await request.get("/api/admin/export?dataset=customers&format=csv")).status()).toBe(403);
  await loginAdmin(page, "/admin/export", "accounting");
  expect((await page.request.get("/api/admin/export?dataset=orders&format=csv")).status()).toBe(
    200,
  );
  expect((await page.request.get("/api/admin/export?dataset=customers&format=csv")).status()).toBe(
    403,
  );
});
