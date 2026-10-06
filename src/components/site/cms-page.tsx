import { notFound } from "next/navigation";

import { Blocks } from "@/components/site/blocks";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db";
import { getPage } from "@/server/services/content";

export async function cmsMetadata(slug: string) {
  const page = await getPage(db, slug);
  return page
    ? {
        title: page.slug === "start" ? { absolute: page.title } : page.title,
        description: page.metaDescription,
      }
    : {};
}

export async function CmsPage({ slug }: { slug: string }) {
  const page = await getPage(db, slug);
  if (!page) notFound();
  const legal = page.kind === "legal";
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      {legal ? <h1 className="mb-2 text-3xl font-semibold">{page.title}</h1> : null}
      {legal && page.updatedAt ? (
        <p className="mb-6 text-sm text-muted-foreground">Stand: {formatDate(page.updatedAt)}</p>
      ) : null}
      <Blocks blocks={page.blocks} firstHeadingIsH1={!legal} />
    </main>
  );
}
