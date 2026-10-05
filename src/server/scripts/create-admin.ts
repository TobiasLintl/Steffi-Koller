import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { eq } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Creates the first admin account (or promotes an existing one):
 *   pnpm admin:create info@seelenzeit.de "Steffi Koller"
 * The password is set via "Passwort vergessen" – staff without a password receive the
 * invitation mail. 2FA is enforced on first access to the admin area.
 */
async function main() {
  const [emailArg, name = "Admin"] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: pnpm admin:create <email> "<Name>"');
    process.exit(2);
  }
  const { createDb } = await import("@/server/db");
  const { customerProfiles, users } = await import("@/server/db/schema");
  const { writeAudit } = await import("@/server/audit/log");
  const { db, close } = createDb(process.env.DATABASE_URL ?? "", 1);
  try {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    const id = existing?.id ?? randomUUID();
    if (existing) {
      await db
        .update(users)
        .set({ role: "admin", emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, id));
    } else {
      await db.insert(users).values({ id, email, name, role: "admin", emailVerified: true });
      await db.insert(customerProfiles).values({ userId: id });
    }
    await writeAudit(db, {
      action: "role.changed",
      actorUserId: null,
      actorRole: "cli",
      targetType: "user",
      targetId: id,
      reason: "admin:create",
      metadata: { to: "admin", from: existing?.role ?? null },
    });
    const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.seelenzeit.de";
    console.log(`Admin account ready: ${email}`);
    console.log(
      `Next step: open ${url}/passwort-vergessen, enter the address and follow the e-mail link.`,
    );
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
