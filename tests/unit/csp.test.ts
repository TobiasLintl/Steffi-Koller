import { describe, expect, it } from "vitest";

import { buildCsp } from "@/server/http/csp";

describe("content security policy", () => {
  it("allows scripts only with the nonce and blocks framing", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("permits the private bucket for media and uploads, the Bunny player and consented statistics", () => {
    const csp = buildCsp({
      nonce: "n",
      isDev: false,
      s3Endpoint: "https://fsn1.your-objectstorage.com",
      s3Bucket: "seelenzeit",
      statisticsScriptUrl: "https://stats.example.test/js/script.js",
    });
    expect(csp).toContain(
      "media-src 'self' blob: https://fsn1.your-objectstorage.com https://seelenzeit.fsn1.your-objectstorage.com",
    );
    expect(csp).toContain("frame-src https://iframe.mediadelivery.net");
    expect(csp).toContain("https://stats.example.test");
  });
});
