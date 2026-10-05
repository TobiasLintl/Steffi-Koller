import { db } from "@/server/db";
import { storage } from "@/server/media/registry";
import { getSiteAsset } from "@/server/services/content";

/** Public website images (CMS). Course media never goes through this route. */
export async function GET(_request: Request, { params }: RouteContext<"/api/assets/[id]">) {
  const { id } = await params;
  const asset = await getSiteAsset(db, id);
  if (!asset || !asset.storageKey.startsWith("site/"))
    return new Response("Not found", { status: 404 });
  const body = await storage().getObject(asset.storageKey);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(body), {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}
