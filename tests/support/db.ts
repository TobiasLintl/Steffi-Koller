import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { createDb, type Db } from "@/server/db";
import { customerProfiles, users } from "@/server/db/schema";

let handle: { db: Db; close: () => Promise<void> } | undefined;

export function testDb(): Db {
  handle ??= createDb(process.env.DATABASE_URL ?? "", 2);
  return handle.db;
}

export async function closeTestDb(): Promise<void> {
  await handle?.close();
  handle = undefined;
}

/** Empties all data tables except reference data (roles) and the append-only audit log. */
export async function resetTables(db: Db = testDb()): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(sql`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not in ('roles', 'audit_log', '__drizzle_migrations')
  `);
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function createUser(
  db: Db,
  input: Partial<{ email: string; name: string; role: string }> = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = input.email ?? `user-${id.slice(0, 8)}@example.test`;
  await db.insert(users).values({
    id,
    email,
    name: input.name ?? "Test Person",
    role: input.role ?? "customer",
    emailVerified: true,
  });
  await db.insert(customerProfiles).values({ userId: id });
  return { id, email };
}
