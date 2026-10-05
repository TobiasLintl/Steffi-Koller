import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hashPassword, symmetricEncrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { createDb } from "./index";
import {
  accounts,
  courses,
  customerProfiles,
  entitlements,
  lessonMedia,
  lessons,
  media,
  modules,
  productProviderMappings,
  products,
  twoFactors,
  users,
} from "./schema";

if (existsSync(".env")) process.loadEnvFile(".env");

// Fictional test data only – never real customer data (CLAUDE.md §6).
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "seelenzeit-dev-123";

const PEOPLE = [
  { email: "admin@example.test", name: "Ada Admin", role: "admin" },
  { email: "support@example.test", name: "Sam Support", role: "support" },
  { email: "redaktion@example.test", name: "Ella Editor", role: "editor" },
  { email: "buchhaltung@example.test", name: "Bea Buchhaltung", role: "accounting" },
  { email: "freigabe@example.test", name: "Rita Review", role: "report_approver" },
  { email: "kundin@example.test", name: "Klara Kundin", role: "customer", country: "DE" },
  { email: "kunde.ch@example.test", name: "Urs Kunde", role: "customer", country: "CH" },
  {
    email: "firma@example.test",
    name: "Fiona Firma",
    role: "customer",
    country: "AT",
    b2b: { companyName: "Beispiel Coaching GmbH", vatId: "ATU12345678" },
  },
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const { db, close } = createDb(url, 1);
  const password = await hashPassword(SEED_PASSWORD);

  try {
    for (const person of PEOPLE) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, person.email));
      if (existing) continue;
      const id = randomUUID();
      await db.insert(users).values({
        id,
        email: person.email,
        name: person.name,
        role: person.role,
        emailVerified: true,
      });
      await db.insert(accounts).values({
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password,
      });
      const b2b = "b2b" in person ? person.b2b : undefined;
      await db.insert(customerProfiles).values({
        userId: id,
        firstName: person.name.split(" ")[0],
        lastName: person.name.split(" ")[1],
        country: "country" in person ? person.country : null,
        customerType: b2b ? "b2b" : "b2c",
        companyName: b2b?.companyName,
        vatId: b2b?.vatId,
        street: b2b ? "Musterweg 1" : null,
        postalCode: b2b ? "1010" : null,
        city: b2b ? "Wien" : null,
      });
    }
    await seedCatalog(db);
    await seedAdminTwoFactor(db);
    await seedMedia(db);
    console.log(
      `Seeded ${PEOPLE.length} fictional users (password: ${SEED_PASSWORD}) and example courses.`,
    );
  } finally {
    await close();
  }
}

type SeedDb = ReturnType<typeof createDb>["db"];

/** A tiny valid one-page PDF with the given text. */
function samplePdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Example PDFs for local development (local storage driver only). */
async function seedMedia(db: SeedDb) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") return;
  const root = path.resolve(process.env.LOCAL_STORAGE_DIR ?? "./var/storage");
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(courses.slug, "achtsam-durch-den-tag"))
    .orderBy(modules.position, lessons.position)
    .limit(1);
  if (!lesson) return;
  const [existing] = await db
    .select({ id: lessonMedia.mediaId })
    .from(lessonMedia)
    .where(eq(lessonMedia.lessonId, lesson.id));
  if (existing) return;
  const items = [
    {
      title: "Workbook zum Herunterladen (Beispiel)",
      fileName: "workbook.pdf",
      downloadAllowed: true,
    },
    {
      title: "Arbeitsblatt nur zum Ansehen (Beispiel)",
      fileName: "arbeitsblatt.pdf",
      downloadAllowed: false,
    },
  ];
  for (const [i, item] of items.entries()) {
    const id = randomUUID();
    const storageKey = `pdf/${id}.pdf`;
    const file = path.join(root, storageKey);
    mkdirSync(path.dirname(file), { recursive: true });
    const pdf = samplePdf(item.title);
    writeFileSync(file, pdf);
    await db.insert(media).values({
      id,
      kind: "pdf",
      title: item.title,
      fileName: item.fileName,
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      downloadAllowed: item.downloadAllowed,
      storageKey,
      status: "ready",
    });
    await db.insert(lessonMedia).values({ lessonId: lesson.id, mediaId: id, position: i });
  }
}

/**
 * Development only: the seeded admin gets a fixed, publicly known TOTP secret so that local
 * E2E tests can sign in. Never run the seed against production.
 */
export const DEV_ADMIN_TOTP_SECRET = "seelenzeit-dev-totp-secret-00001";

async function seedAdminTwoFactor(db: SeedDb) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || process.env.NODE_ENV === "production") return;
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@example.test"));
  if (!admin) return;
  const [existing] = await db
    .select({ id: twoFactors.id })
    .from(twoFactors)
    .where(eq(twoFactors.userId, admin.id));
  if (existing) return;
  await db.insert(twoFactors).values({
    id: randomUUID(),
    userId: admin.id,
    secret: await symmetricEncrypt({ key: secret, data: DEV_ADMIN_TOTP_SECRET }),
    backupCodes: await symmetricEncrypt({ key: secret, data: JSON.stringify(["devbk-00001"]) }),
    verified: true,
  });
  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, admin.id));
}

const COURSES = [
  {
    slug: "achtsam-durch-den-tag",
    title: "Achtsam durch den Tag (Beispielkurs)",
    description: "Ein kleiner Selbstlernkurs in zwei Teilen – fiktive Beispieldaten.",
    tier: "small" as const,
    priceEurCents: 4900,
    priceChfCents: 4900,
    modules: [
      { title: "Ankommen", days: 0, lessons: ["Willkommen", "Dein Morgenritual"] },
      { title: "Im Alltag", days: 0, lessons: ["Kleine Pausen", "Der Abend gehört dir"] },
    ],
  },
  {
    slug: "selbstliebe-kurs",
    title: "Selbstliebe in acht Schritten (Beispielkurs)",
    description: "Ein mittlerer Kurs mit acht Teilen – fiktive Beispieldaten.",
    tier: "medium" as const,
    priceEurCents: 9900,
    priceChfCents: 9900,
    modules: Array.from({ length: 8 }, (_, i) => ({
      title: `Schritt ${i + 1}`,
      days: 0,
      lessons: [`Impuls ${i + 1}`, `Übung ${i + 1}`],
    })),
  },
  {
    slug: "jahresweg",
    title: "Der Jahresweg (Beispielkurs)",
    description:
      "Der große Kurs: 12 Module, jeden Monat wird ein neues freigeschaltet – fiktive Beispieldaten.",
    tier: "large" as const,
    priceEurCents: 89000,
    priceChfCents: 89000,
    modules: Array.from({ length: 12 }, (_, i) => ({
      title: `Monat ${i + 1}`,
      days: i * 30,
      lessons: [`Einführung Monat ${i + 1}`, `Vertiefung Monat ${i + 1}`],
    })),
  },
];

const ACCESS = {
  small: { access: 6, extension: 3 },
  medium: { access: 6, extension: 3 },
  large: { access: 24, extension: 6 },
};

async function seedCatalog(db: SeedDb) {
  for (const [ci, def] of COURSES.entries()) {
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, def.slug));
    if (existing) continue;
    const [course] = await db
      .insert(courses)
      .values({ slug: def.slug, title: def.title, description: def.description, isPublished: true })
      .returning();
    for (const [mi, m] of def.modules.entries()) {
      const [mod] = await db
        .insert(modules)
        .values({ courseId: course!.id, title: m.title, position: mi, unlockAfterDays: m.days })
        .returning();
      for (const [li, title] of m.lessons.entries()) {
        await db.insert(lessons).values({
          moduleId: mod!.id,
          title,
          position: li,
          durationMinutes: 8 + li * 4,
          body: `## ${title}\n\nDies ist ein fiktiver Beispieltext für die Entwicklung.\n\nNimm dir einen Moment Zeit, atme ruhig und lies in deinem Tempo weiter.\n\n- Ein erster Gedanke\n- Eine kleine Übung\n- Eine Frage für dich`,
          transcript: "Fiktives Transkript für die Entwicklung.",
        });
      }
    }
    const rules = ACCESS[def.tier];
    await db.insert(products).values([
      {
        slug: def.slug,
        title: def.title.replace(" (Beispielkurs)", ""),
        subtitle: def.description,
        description: `${def.description}\n\nZugang für ${rules.access} Monate ab Kauf, kein Abo, keine automatische Verlängerung.`,
        tier: def.tier,
        kind: "course_access" as const,
        courseId: course!.id,
        accessMonths: rules.access,
        priceEurCents: def.priceEurCents,
        priceChfCents: def.priceChfCents,
        checkoutUrl: `https://www.copecart.com/products/beispiel-${def.slug}/checkout`,
        isPublished: true,
        sortOrder: ci,
      },
      {
        slug: `${def.slug}-verlaengerung`,
        title: `Verlängerung: ${def.title.replace(" (Beispielkurs)", "")}`,
        subtitle: `+${rules.extension} Monate Zugang`,
        tier: def.tier,
        kind: "extension" as const,
        courseId: course!.id,
        extensionMonths: rules.extension,
        priceEurCents: Math.round(def.priceEurCents * 0.3),
        priceChfCents: Math.round(def.priceChfCents * 0.3),
        checkoutUrl: `https://www.copecart.com/products/beispiel-${def.slug}-verlaengerung/checkout`,
        isPublished: true,
        sortOrder: 100 + ci,
      },
    ]);
  }

  // Example reseller mappings (fictional CopeCart product ids).
  const seededProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
  for (const p of seededProducts) {
    await db
      .insert(productProviderMappings)
      .values({ provider: "copecart", providerProductId: `cc-${p.slug}`, productId: p.id })
      .onConflictDoNothing();
  }

  // Example access: Klara has the small course (active) and the medium one (expired).
  const [klara] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "kundin@example.test"));
  const [urs] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "kunde.ch@example.test"));
  const bySlug = async (slug: string) =>
    (await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)))[0]!.id;
  const now = Date.now();
  const month = 30 * 24 * 60 * 60 * 1000;
  const grants = [
    {
      userId: klara?.id,
      courseId: await bySlug("achtsam-durch-den-tag"),
      startsAt: new Date(now - month),
      expiresAt: new Date(now + 5 * month),
    },
    {
      userId: klara?.id,
      courseId: await bySlug("selbstliebe-kurs"),
      startsAt: new Date(now - 8 * month),
      expiresAt: new Date(now - 2 * month),
    },
    {
      userId: urs?.id,
      courseId: await bySlug("jahresweg"),
      startsAt: new Date(now - 2 * month - 1000),
      expiresAt: new Date(now + 22 * month),
    },
  ];
  for (const g of grants) {
    if (!g.userId) continue;
    await db
      .insert(entitlements)
      .values({
        userId: g.userId,
        courseId: g.courseId,
        source: "manual",
        startsAt: g.startsAt,
        expiresAt: g.expiresAt,
      })
      .onConflictDoNothing();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
