"use server";

import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { faqItems, siteAssets } from "@/server/db/schema";
import {
  blockSchema,
  moveBlock,
  newBlock,
  type Block,
  type BlockType,
} from "@/server/domain/content/blocks";
import { pageDefault } from "@/server/domain/content/defaults";
import { storage } from "@/server/media/registry";
import { getPage, savePage } from "@/server/services/content";

async function guard() {
  return requirePermission("content:write", "/admin/inhalte");
}

function revalidateSite(slug: string) {
  revalidatePath(`/admin/inhalte/${slug}`);
  revalidatePath(slug === "start" ? "/" : `/${slug}`);
}

async function loadBlocks(slug: string): Promise<Block[]> {
  if (!pageDefault(slug)) throw new Error("Unknown page");
  return (await getPage(db, slug))?.blocks ?? [];
}

const metaSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt.").max(120),
  metaDescription: z.string().trim().max(300),
});

export async function savePageMetaAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await guard();
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await loadBlocks(slug);
  await savePage(db, actor.id, slug, parsed.data);
  revalidateSite(slug);
  return { ok: true, message: "Gespeichert." };
}

export async function saveBlockAction(
  slug: string,
  blockId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await guard();
  const blocks = await loadBlocks(slug);
  const current = blocks.find((b) => b.id === blockId);
  if (!current) return { ok: false, message: "Block nicht gefunden." };
  const raw: Record<string, unknown> = { ...current, ...Object.fromEntries(formData) };
  if ("limit" in raw) raw.limit = Number(raw.limit);
  const parsed = blockSchema.safeParse({ ...raw, id: blockId, type: current.type });
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte prüfe die Eingaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  await savePage(db, actor.id, slug, {
    blocks: blocks.map((b) => (b.id === blockId ? parsed.data : b)),
  });
  revalidateSite(slug);
  return { ok: true, message: "Gespeichert." };
}

export async function addBlockAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await guard();
  const type = z
    .enum(["hero", "text", "image", "cta", "offers", "faq", "newsletter", "free_products"])
    .safeParse(formData.get("type"));
  if (!type.success) return { ok: false, message: "Bitte einen Blocktyp wählen." };
  const blocks = await loadBlocks(slug);
  await savePage(db, actor.id, slug, {
    blocks: [...blocks, newBlock(type.data as BlockType, randomUUID().slice(0, 8))],
  });
  revalidateSite(slug);
  return { ok: true, message: "Block hinzugefügt." };
}

export async function moveBlockAction(
  slug: string,
  blockId: string,
  direction: -1 | 1,
): Promise<void> {
  const actor = await guard();
  await savePage(db, actor.id, slug, {
    blocks: moveBlock(await loadBlocks(slug), blockId, direction),
  });
  revalidateSite(slug);
}

export async function deleteBlockAction(slug: string, blockId: string): Promise<void> {
  const actor = await guard();
  await savePage(db, actor.id, slug, {
    blocks: (await loadBlocks(slug)).filter((b) => b.id !== blockId),
  });
  revalidateSite(slug);
}

/* ------------------------------- Images ------------------------------- */

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const file = formData.get("file");
  const alt = String(formData.get("alt") ?? "").slice(0, 200);
  if (!(file instanceof File) || !IMAGE_TYPES[file.type])
    return { ok: false, message: "Bitte ein JPG-, PNG- oder WebP-Bild wählen." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, message: "Das Bild darf höchstens 5 MB groß sein." };
  const id = randomUUID();
  const storageKey = `site/${id}.${IMAGE_TYPES[file.type]}`;
  await storage().putObject(storageKey, new Uint8Array(await file.arrayBuffer()), file.type);
  await db
    .insert(siteAssets)
    .values({ id, storageKey, fileName: file.name.slice(0, 200), mimeType: file.type, alt });
  revalidatePath("/admin/inhalte");
  return { ok: true, message: `Bild hochgeladen. Bild-ID: ${id}` };
}

/* --------------------------------- FAQ -------------------------------- */

const faqSchema = z.object({
  question: z.string().trim().min(3, "Frage fehlt.").max(300),
  answer: z.string().trim().min(3, "Antwort fehlt.").max(5000),
});

export async function createFaqAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = faqSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const all = await db.select({ position: faqItems.position }).from(faqItems);
  await db
    .insert(faqItems)
    .values({ ...parsed.data, position: Math.max(-1, ...all.map((f) => f.position)) + 1 });
  revalidatePath("/admin/inhalte");
  revalidatePath("/faq");
  return { ok: true, message: "Frage hinzugefügt." };
}

export async function updateFaqAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = faqSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await db
    .update(faqItems)
    .set({
      ...parsed.data,
      isPublished: formData.get("isPublished") === "on",
      updatedAt: new Date(),
    })
    .where(eq(faqItems.id, z.uuid().parse(id)));
  revalidatePath("/admin/inhalte");
  revalidatePath("/faq");
  return { ok: true, message: "Gespeichert." };
}

export async function deleteFaqAction(id: string): Promise<void> {
  await guard();
  await db.delete(faqItems).where(eq(faqItems.id, z.uuid().parse(id)));
  revalidatePath("/admin/inhalte");
  revalidatePath("/faq");
}

export async function moveFaqAction(id: string, direction: -1 | 1): Promise<void> {
  await guard();
  const items = await db
    .select()
    .from(faqItems)
    .orderBy(asc(faqItems.position), asc(faqItems.createdAt));
  const index = items.findIndex((i) => i.id === id);
  const target = items[index + direction];
  if (index < 0 || !target) return;
  await db.transaction(async (tx) => {
    for (const [i, item] of items.entries()) {
      const position = i === index ? index + direction : i === index + direction ? index : i;
      await tx.update(faqItems).set({ position }).where(eq(faqItems.id, item.id));
    }
  });
  revalidatePath("/admin/inhalte");
  revalidatePath("/faq");
}
