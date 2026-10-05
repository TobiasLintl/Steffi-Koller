import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("without a consent decision", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("no third-party or tracking requests without consent", async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (!["data:", "blob:"].includes(url.protocol) && url.origin !== new URL(baseURL!).origin)
        foreign.push(req.url());
    });
    for (const path of [
      "/",
      "/angebote",
      "/angebote/achtsam-durch-den-tag",
      "/faq",
      "/kontakt",
      "/gratis",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(300);
    }
    expect(foreign).toEqual([]);
    const cookies = await page.context().cookies();
    expect(cookies.map((c) => c.name)).not.toContain("sz_consent");
  });

  test("consent banner stores the decision and can be reopened", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Cookies & Datenschutz" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Nur notwendige" }).click();
    await expect(banner).toBeHidden();
    const consent = (await page.context().cookies()).find((c) => c.name === "sz_consent");
    expect(decodeURIComponent(consent!.value)).toContain('"statistics":false');

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Cookies & Datenschutz" })).toBeHidden();
    await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await expect(page.getByRole("dialog", { name: "Cookies & Datenschutz" })).toBeVisible();
  });
});

test("product page shows prices in EUR and CHF and links to the reseller checkout", async ({
  page,
}) => {
  await page.goto("/angebote/achtsam-durch-den-tag");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Achtsam durch den Tag");
  await expect(page.getByText(/49,00\s€/)).toBeVisible();
  await expect(page.getByText(/CHF\s49\.00/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Jetzt kaufen" })).toHaveAttribute(
    "href",
    /copecart\.com/,
  );
});

test("legal pages show the placeholder until the legal texts are delivered", async ({ page }) => {
  for (const [path, title] of [
    ["/impressum", "Impressum"],
    ["/datenschutz", "Datenschutzerklärung"],
    ["/agb", "Allgemeine Geschäftsbedingungen"],
    ["/widerruf", "Widerrufsbelehrung"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByText("Text wird von Rechtstext-Dienst geliefert.")).toBeVisible();
  }
});

test("contact form accepts a message", async ({ page }) => {
  await page.goto("/kontakt");
  await page.getByLabel("Name").fill("Testperson");
  await page.getByLabel("E-Mail-Adresse").fill("test.kontakt@example.test");
  await page.getByLabel("Betreff").fill("Frage zum Kurs");
  await page.getByLabel("Deine Nachricht").fill("Hallo, wie lange habe ich Zugriff auf den Kurs?");
  await page.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(page.getByText("Danke für deine Nachricht!")).toBeVisible();
});

test("a free offer is unlocked for a signed-in customer", async ({ page }) => {
  await login(page, "kunde.ch@example.test");
  await page.goto("/gratis");
  await page.getByRole("button", { name: "Kostenlos freischalten" }).first().click();
  await expect(page).toHaveURL(/\/konto\/kurse\/mini-workbook$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Mini-Workbook: Ankommen (Beispiel)",
  );
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/angebote/achtsam-durch-den-tag");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
});
