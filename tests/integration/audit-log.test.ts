import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { writeAudit } from "@/server/audit/log";
import { auditLog } from "@/server/db/schema";
import { closeTestDb, testDb } from "../support/db";

describe("audit log", () => {
  afterAll(closeTestDb);

  it("stores entries and refuses updates and deletes (append-only)", async () => {
    const db = testDb();
    await writeAudit(db, {
      action: "entitlement.granted",
      actorUserId: "admin-1",
      actorRole: "admin",
      targetType: "entitlement",
      targetId: "ent-1",
      reason: "Kulanz",
    });
    const [row] = await db.select().from(auditLog).where(eq(auditLog.targetId, "ent-1"));
    expect(row).toMatchObject({ action: "entitlement.granted", reason: "Kulanz" });

    await expect(
      db.update(auditLog).set({ reason: "x" }).where(eq(auditLog.id, row!.id)),
    ).rejects.toThrow();
    await expect(db.delete(auditLog).where(eq(auditLog.id, row!.id))).rejects.toThrow();
  });
});
