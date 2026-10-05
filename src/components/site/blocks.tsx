import Link from "next/link";

import { RichText } from "@/components/rich-text";
import { ProductCard } from "@/components/site/product-card";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/server/db";
import type { Block } from "@/server/domain/content/blocks";
import { listFreeProducts, listPublicOffers } from "@/server/services/catalog";
import { listFaq } from "@/server/services/content";
import { FreeProductClaim } from "./free-product-claim";
import { NewsletterBlock } from "./newsletter-block";

function isExternal(href: string) {
  return /^https:\/\//.test(href);
}

function CtaLink({
  href,
  label,
  variant = "default",
}: {
  href: string;
  label: string;
  variant?: "default" | "outline";
}) {
  if (!href || !label) return null;
  const className = buttonVariants({ size: "lg", variant });
  return isExternal(href) ? (
    <a href={href} className={className} rel="noopener">
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

/** Renders CMS blocks. The first heading on a page is the page's h1. */
export async function Blocks({
  blocks,
  firstHeadingIsH1 = true,
}: {
  blocks: Block[];
  firstHeadingIsH1?: boolean;
}) {
  const h1BlockId = firstHeadingIsH1
    ? blocks.find((b) => "heading" in b && b.heading)?.id
    : undefined;
  function headingFor(blockId: string) {
    return function renderHeading(text: string, className: string) {
      if (!text) return null;
      return blockId === h1BlockId ? (
        <h1 className={className}>{text}</h1>
      ) : (
        <h2 className={className}>{text}</h2>
      );
    };
  }

  const rendered = [];
  for (const block of blocks) {
    const heading = headingFor(block.id);
    switch (block.type) {
      case "hero":
        rendered.push(
          <section key={block.id} className="flex flex-col gap-5 py-10 sm:py-16">
            {block.imageId ? (
              // eslint-disable-next-line @next/next/no-img-element -- CMS image of unknown size
              <img
                src={`/api/assets/${block.imageId}`}
                alt=""
                className="max-h-80 w-full rounded-2xl object-cover"
              />
            ) : null}
            {heading(block.heading, "text-3xl leading-tight font-semibold sm:text-5xl")}
            {block.body ? (
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">{block.body}</p>
            ) : null}
            <div>
              <CtaLink href={block.ctaHref} label={block.ctaLabel} />
            </div>
          </section>,
        );
        break;
      case "text":
        rendered.push(
          <section key={block.id} className="flex max-w-3xl flex-col gap-4 py-6">
            {heading(block.heading, "text-2xl font-semibold")}
            <RichText text={block.body} />
          </section>,
        );
        break;
      case "image":
        if (block.imageId) {
          rendered.push(
            <figure key={block.id} className="flex flex-col gap-2 py-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS image of unknown size */}
              <img
                src={`/api/assets/${block.imageId}`}
                alt={block.alt}
                loading="lazy"
                className="w-full rounded-2xl object-cover"
              />
              {block.caption ? (
                <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
              ) : null}
            </figure>,
          );
        }
        break;
      case "cta":
        rendered.push(
          <section
            key={block.id}
            className="my-6 flex flex-col gap-3 rounded-2xl bg-secondary p-6 sm:p-8"
          >
            {heading(block.heading, "text-2xl font-semibold")}
            {block.body ? <p className="text-muted-foreground">{block.body}</p> : null}
            <div>
              <CtaLink href={block.href} label={block.label} />
            </div>
          </section>,
        );
        break;
      case "offers": {
        const offers = await listPublicOffers(db);
        rendered.push(
          <section key={block.id} className="flex flex-col gap-4 py-6">
            {heading(block.heading, "text-2xl font-semibold")}
            {offers.length === 0 ? (
              <p className="text-muted-foreground">Bald findest du hier unsere Angebote.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {offers.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>,
        );
        break;
      }
      case "free_products": {
        const free = await listFreeProducts(db);
        rendered.push(
          <section key={block.id} className="flex flex-col gap-4 py-6">
            {heading(block.heading, "text-2xl font-semibold")}
            {free.length === 0 ? (
              <p className="text-muted-foreground">
                Gerade gibt es hier nichts Kostenloses – schau bald wieder vorbei.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {free.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                    <h3 className="text-lg font-semibold">{p.title}</h3>
                    {p.subtitle ? (
                      <p className="text-sm text-muted-foreground">{p.subtitle}</p>
                    ) : null}
                    <FreeProductClaim productId={p.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>,
        );
        break;
      }
      case "faq": {
        const items = await listFaq(db, { publishedOnly: true, limit: block.limit });
        if (items.length) {
          rendered.push(
            <section key={block.id} className="flex max-w-3xl flex-col gap-3 py-6">
              {heading(block.heading, "text-2xl font-semibold")}
              {items.map((item) => (
                <details key={item.id} className="rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer font-medium">{item.question}</summary>
                  <div className="mt-3 text-muted-foreground">
                    <RichText text={item.answer} />
                  </div>
                </details>
              ))}
              <Link href="/faq" className="text-sm underline underline-offset-4">
                Alle Fragen ansehen
              </Link>
            </section>,
          );
        }
        break;
      }
      case "newsletter":
        rendered.push(
          <NewsletterBlock
            key={block.id}
            heading={heading(block.heading, "text-2xl font-semibold")}
            body={block.body}
          />,
        );
        break;
    }
  }
  return <>{rendered}</>;
}
