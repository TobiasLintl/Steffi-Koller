import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("AK-08: lesson PDFs are delivered via short-lived signed links, downloads only where allowed", async ({
  page,
  request,
}) => {
  await login(page, "kundin@example.test");
  await page.goto("/konto/kurse/achtsam-durch-den-tag");
  await page.getByRole("link", { name: "Willkommen" }).click();

  const downloadable = page.getByText("Workbook zum Herunterladen (Beispiel)").locator("..");
  await expect(downloadable.getByRole("link", { name: "Herunterladen" })).toBeVisible();
  const viewOnly = page.getByText("Arbeitsblatt nur zum Ansehen (Beispiel)").locator("..");
  await expect(viewOnly.getByRole("link", { name: "Ansehen" })).toBeVisible();
  await expect(viewOnly.getByRole("link", { name: "Herunterladen" })).toHaveCount(0);

  // The link in the page is our access-checked endpoint, not a storage URL.
  const viewHref = await viewOnly.getByRole("link", { name: "Ansehen" }).getAttribute("href");
  expect(viewHref).toMatch(/^\/api\/media\//);

  // Signed in: redirected to a signed, expiring URL; forcing download=1 still yields inline.
  const res = await page.request.get(`${viewHref}&download=1`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const location = new URL(res.headers().location!, page.url());
  expect(location.searchParams.get("exp")).toBeTruthy();
  expect(location.searchParams.get("sig")).toBeTruthy();
  expect(location.searchParams.get("disposition")).toBe("inline");
  const file = await page.request.get(location.toString());
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");

  // Tampered signature → forbidden.
  location.searchParams.set("disposition", "attachment");
  expect((await page.request.get(location.toString())).status()).toBe(403);

  // Without a session the endpoint reveals nothing.
  expect((await request.get(viewHref!, { maxRedirects: 0 })).status()).toBe(404);
});
