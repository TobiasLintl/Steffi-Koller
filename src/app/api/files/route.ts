import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { contentDisposition, safeKeyPath, verifyLocal } from "@/server/adapters/storage";
import { serverEnv } from "@/server/env";
import { localSigningSecret } from "@/server/media/registry";

/** Local storage driver only (development): serves/accepts files behind signed, expiring URLs. */
function signedParams(url: URL) {
  const p = url.searchParams;
  return {
    params: {
      key: p.get("key") ?? "",
      op: (p.get("op") ?? "") as "get" | "put",
      exp: Number(p.get("exp")),
      disposition: p.get("disposition") ?? undefined,
      name: p.get("name") ?? undefined,
      type: p.get("type") ?? undefined,
    },
    sig: p.get("sig") ?? "",
  };
}

function enabled() {
  return serverEnv().STORAGE_DRIVER === "local";
}

export async function GET(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const { params, sig } = signedParams(new URL(request.url));
  if (params.op !== "get" || !verifyLocal(localSigningSecret(), params, sig)) {
    return new Response("Forbidden", { status: 403 });
  }
  let file: string;
  try {
    file = safeKeyPath(path.resolve(serverEnv().LOCAL_STORAGE_DIR), params.key);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "content-type": params.type ?? "application/octet-stream",
    "content-disposition": contentDisposition(
      params.disposition === "attachment" ? "attachment" : "inline",
      params.name,
    ),
    "cache-control": "private, no-store",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size)
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${info.size}` },
      });
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${start}-${end}/${info.size}`,
        "content-length": String(end - start + 1),
      },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "content-length": String(info.size) } });
}

export async function PUT(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const { params, sig } = signedParams(new URL(request.url));
  if (params.op !== "put" || !verifyLocal(localSigningSecret(), params, sig) || !request.body) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = safeKeyPath(path.resolve(serverEnv().LOCAL_STORAGE_DIR), params.key);
  await mkdir(path.dirname(file), { recursive: true });
  await pipeline(
    Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
    createWriteStream(file),
  );
  return new Response(null, { status: 200 });
}
