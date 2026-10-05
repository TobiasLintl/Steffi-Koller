import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { contactMessages, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib deinen Namen an.").max(100),
  email: z.email("Bitte gib eine gültige E-Mail-Adresse an.").max(200),
  subject: z.string().trim().min(1, "Worum geht es?").max(200),
  message: z.string().trim().min(10, "Deine Nachricht ist etwas kurz.").max(5000),
});

export async function createContactMessage(
  db: DbExecutor,
  input: z.infer<typeof contactSchema>,
  userId?: string | null,
) {
  const email = input.email.toLowerCase();
  const linkedUser =
    userId ??
    (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]?.id ??
    null;
  const [row] = await db
    .insert(contactMessages)
    .values({ ...input, email, userId: linkedUser })
    .returning({ id: contactMessages.id });
  return row!.id;
}

export async function listContactMessages(db: DbExecutor, status?: "open" | "done") {
  return db
    .select()
    .from(contactMessages)
    .where(status ? eq(contactMessages.status, status) : undefined)
    .orderBy(desc(contactMessages.createdAt))
    .limit(200);
}

export async function markContactMessage(
  db: DbExecutor,
  id: string,
  status: "open" | "done",
  actorId: string,
) {
  await db
    .update(contactMessages)
    .set({
      status,
      handledAt: status === "done" ? new Date() : null,
      handledBy: status === "done" ? actorId : null,
    })
    .where(eq(contactMessages.id, id));
}
