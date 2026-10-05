import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  contentDisposition,
  createLocalStorageAdapter,
  safeKeyPath,
  verifyLocal,
} from "@/server/adapters/storage";
import { bunnyEmbedToken, createBunnyVideoAdapter, mapBunnyStatus } from "@/server/adapters/video";

function paramsOf(url: string) {
  const u = new URL(url);
  const p = Object.fromEntries(u.searchParams);
  return {
    params: {
      key: p.key!,
      op: p.op as "get" | "put",
      exp: Number(p.exp),
      disposition: p.disposition,
      name: p.name,
      type: p.type,
    },
    sig: p.sig!,
  };
}

describe("local storage signed URLs (AK-08)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sz-storage-"));
  const t0 = Date.parse("2026-05-01T10:00:00Z");
  const storage = createLocalStorageAdapter({
    rootDir: root,
    baseUrl: "http://app",
    signingSecret: "s3cret",
    now: () => t0,
  });

  it("issues URLs valid for 10 minutes by default, then rejected", async () => {
    const { params, sig } = paramsOf(
      await storage.getSignedDownloadUrl("pdf/a.pdf", { disposition: "inline" }),
    );
    expect(params.exp).toBe(t0 / 1000 + 600);
    expect(verifyLocal("s3cret", params, sig, t0 + 599_000)).toBe(true);
    expect(verifyLocal("s3cret", params, sig, t0 + 601_000)).toBe(false);
  });

  it("rejects tampered keys, dispositions and signatures", async () => {
    const { params, sig } = paramsOf(
      await storage.getSignedDownloadUrl("pdf/a.pdf", { disposition: "inline" }),
    );
    expect(verifyLocal("s3cret", { ...params, key: "pdf/b.pdf" }, sig, t0)).toBe(false);
    expect(verifyLocal("s3cret", { ...params, disposition: "attachment" }, sig, t0)).toBe(false);
    expect(verifyLocal("other", params, sig, t0)).toBe(false);
  });

  it("blocks path traversal", () => {
    expect(() => safeKeyPath(root, "../etc/passwd")).toThrow();
    expect(() => safeKeyPath(root, "/abs")).toThrow();
  });

  it("stores and reads files", async () => {
    await storage.putObject("pdf/x.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
    expect(await storage.headObject("pdf/x.pdf")).toEqual({ size: 3 });
    expect(await storage.headObject("pdf/missing.pdf")).toBeNull();
  });

  it("builds RFC 6266 content-disposition headers", () => {
    expect(contentDisposition("attachment", "Übung 1.pdf")).toBe(
      `attachment; filename="_bung 1.pdf"; filename*=UTF-8''%C3%9Cbung%201.pdf`,
    );
  });
});

describe("Bunny Stream (AK-09)", () => {
  it("signs embed URLs with an expiring token", async () => {
    const now = Date.parse("2026-05-01T10:00:00Z");
    const adapter = createBunnyVideoAdapter({
      libraryId: "123",
      apiKey: "k",
      tokenSecurityKey: "tok",
      now: () => now,
      fetchImpl: fetch,
    });
    const playback = await adapter.getPlayback("vid-1", { ttlSeconds: 3600, captions: [] });
    const url = new URL(playback.url);
    const expires = Number(url.searchParams.get("expires"));
    expect(url.origin + url.pathname).toBe("https://iframe.mediadelivery.net/embed/123/vid-1");
    expect(expires).toBe(now / 1000 + 3600);
    expect(url.searchParams.get("token")).toBe(
      createHash("sha256").update(`tokvid-1${expires}`).digest("hex"),
    );
    // A token is bound to its expiry: a later expiry with the same token is invalid.
    expect(bunnyEmbedToken("tok", "vid-1", expires + 1)).not.toBe(url.searchParams.get("token"));
  });

  it("maps processing states", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(mapBunnyStatus)).toEqual([
      "processing",
      "processing",
      "processing",
      "processing",
      "ready",
      "failed",
      "failed",
    ]);
  });

  it("calls the management API with the access key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ guid: "new-guid", status: 4, length: 90 }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const adapter = createBunnyVideoAdapter({
      libraryId: "123",
      apiKey: "secret-key",
      tokenSecurityKey: "tok",
      fetchImpl: fakeFetch,
    });
    expect(await adapter.createVideo({ title: "Lektion 1" })).toEqual({
      providerVideoId: "new-guid",
    });
    expect(await adapter.getStatus("new-guid")).toEqual({ status: "ready", durationSeconds: 90 });
    expect(calls[0]!.url).toBe("https://video.bunnycdn.com/library/123/videos");
    expect((calls[0]!.init.headers as Record<string, string>).AccessKey).toBe("secret-key");
  });
});
