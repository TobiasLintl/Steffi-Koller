import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { createDb } from "./index";
import { accounts, customerProfiles, users } from "./schema";

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
    console.log(`Seeded ${PEOPLE.length} fictional users (password: ${SEED_PASSWORD}).`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
