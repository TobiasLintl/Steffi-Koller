import { describe, expect, it } from "vitest";

import { createRateLimiter, readBodyLimited } from "@/server/http/rate-limit";

describe("rate limiter", () => {
  it("allows max requests per window and resets afterwards", () => {
    const check = createRateLimiter({ windowMs: 1000, max: 2 });
    expect([check("a", 0), check("a", 1), check("a", 2)]).toEqual([true, true, false]);
    expect(check("b", 2)).toBe(true);
    expect(check("a", 1001)).toBe(true);
  });
});

describe("readBodyLimited", () => {
  it("rejects bodies over the limit", async () => {
    expect(
      await readBodyLimited(new Request("http://x", { method: "POST", body: "x".repeat(20) }), 10),
    ).toBeNull();
    expect(
      await readBodyLimited(new Request("http://x", { method: "POST", body: "hello" }), 10),
    ).toBe("hello");
  });
});
