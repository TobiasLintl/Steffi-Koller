import { eq } from "drizzle-orm";

import type { MailAdapter, TransactionalMailKind } from "@/server/adapters/mail";
import { emailLog } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import type { MailContent } from "@/server/mail/layout";

/**
 * Sends a transactional mail and records it (without the address). With a dedupe key the
 * mail is sent at most once, even if a job runs twice.
 */
export async function sendLoggedMail(
  db: DbExecutor,
  mail: MailAdapter,
  input: {
    kind: TransactionalMailKind;
    to: string;
    userId?: string | null;
    dedupeKey?: string;
    content: MailContent;
    replyTo?: string;
  },
): Promise<"sent" | "skipped" | "failed"> {
  const [entry] = await db
    .insert(emailLog)
    .values({ kind: input.kind, userId: input.userId ?? null, dedupeKey: input.dedupeKey ?? null })
    .onConflictDoNothing({ target: emailLog.dedupeKey })
    .returning({ id: emailLog.id });
  if (!entry) return "skipped";
  try {
    const { messageId } = await mail.send({
      kind: input.kind,
      to: input.to,
      replyTo: input.replyTo,
      ...input.content,
    });
    await db
      .update(emailLog)
      .set({ status: "sent", providerMessageId: messageId, sentAt: new Date() })
      .where(eq(emailLog.id, entry.id));
    return "sent";
  } catch (error) {
    // Free the dedupe key so the next job run retries.
    await db
      .update(emailLog)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
        dedupeKey: null,
      })
      .where(eq(emailLog.id, entry.id));
    return "failed";
  }
}
