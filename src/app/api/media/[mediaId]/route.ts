import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { storage } from "@/server/media/registry";
import { authorizeMediaDelivery } from "@/server/services/media";

/**
 * Delivers a PDF/audio of a lesson: checks session, entitlement and drip, then redirects to a
 * short-lived signed URL (AK-08). The signed URL itself is never stored or shown permanently.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/media/[mediaId]">) {
  const { mediaId } = await params;
  const url = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const kind = url.searchParams.get("play") === "1" ? "play" : "file";
  const env = serverEnv();
  const result = await authorizeMediaDelivery(db, storage(), {
    userId: user.id,
    courseSlug: url.searchParams.get("course") ?? "",
    lessonId: url.searchParams.get("lesson") ?? "",
    mediaId,
    download: url.searchParams.get("download") === "1",
    // Audio playback issues range requests for its whole duration.
    ttlSeconds: kind === "play" ? env.VIDEO_TOKEN_TTL_SECONDS : env.MEDIA_URL_TTL_SECONDS,
  });
  if (result.status !== "ok") return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { location: result.url, "cache-control": "private, no-store" },
  });
}
