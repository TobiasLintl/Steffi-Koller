import { asc, eq } from "drizzle-orm";

import { faqItems, siteAssets, sitePages } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { parseBlocks, type Block } from "@/server/domain/content/blocks";
import { PAGE_DEFAULTS, pageDefault } from "@/server/domain/content/defaults";

export interface PageContent {
  slug: string;
  kind: "content" | "legal";
  title: string;
  metaDescription: string;
  blocks: Block[];
  updatedAt: Date | null;
}

/** Stored page, falling back to the built-in default so the site never shows an empty page. */
export async function getPage(db: DbExecutor, slug: string): Promise<PageContent | null> {
  const [row] = await db.select().from(sitePages).where(eq(sitePages.slug, slug));
  if (row) {
    return {
      slug: row.slug,
      kind: row.kind,
      title: row.title,
      metaDescription: row.metaDescription,
      blocks: parseBlocks(row.blocks),
      updatedAt: row.updatedAt,
    };
  }
  const fallback = pageDefault(slug);
  return fallback ? { ...fallback, updatedAt: null } : null;
}

export async function listPagesForAdmin(db: DbExecutor) {
  const stored = await db
    .select({ slug: sitePages.slug, updatedAt: sitePages.updatedAt })
    .from(sitePages);
  return PAGE_DEFAULTS.map((p) => ({
    slug: p.slug,
    title: p.title,
    kind: p.kind,
    updatedAt: stored.find((s) => s.slug === p.slug)?.updatedAt ?? null,
  }));
}

export async function savePage(
  db: DbExecutor,
  actorId: string,
  slug: string,
  patch: { title?: string; metaDescription?: string; blocks?: Block[] },
): Promise<void> {
  const current = await getPage(db, slug);
  if (!current) throw new Error(`Unknown page ${slug}`);
  const next = {
    title: patch.title ?? current.title,
    metaDescription: patch.metaDescription ?? current.metaDescription,
    blocks: patch.blocks ?? current.blocks,
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  await db
    .insert(sitePages)
    .values({ slug, kind: current.kind, ...next })
    .onConflictDoUpdate({ target: sitePages.slug, set: next });
}

export async function listFaq(db: DbExecutor, options: { publishedOnly: boolean; limit?: number }) {
  const query = db
    .select()
    .from(faqItems)
    .where(options.publishedOnly ? eq(faqItems.isPublished, true) : undefined)
    .orderBy(asc(faqItems.position), asc(faqItems.createdAt));
  return options.limit ? query.limit(options.limit) : query;
}

export async function getSiteAsset(db: DbExecutor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [asset] = await db.select().from(siteAssets).where(eq(siteAssets.id, id));
  return asset;
}

export async function listSiteAssets(db: DbExecutor) {
  return db.select().from(siteAssets).orderBy(asc(siteAssets.createdAt));
}
