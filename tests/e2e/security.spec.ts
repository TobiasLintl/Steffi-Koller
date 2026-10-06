import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("security headers and CSP are sent, and pages run without CSP violations", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy|Refused to/.test(msg.text()))
      violations.push(msg.text());
  });
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();

  await login(page, "kundin@example.test");
  await page.goto("/konto/kurse/achtsam-durch-den-tag");
  await page.getByRole("link", { name: "Willkommen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Willkommen");
  expect(violations).toEqual([]);
});

test("health endpoints report status", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).db).toBe("ok");
  expect([200, 503]).toContain((await request.get("/api/health/backup")).status());
});
