import { describe, expect, it } from "vitest";

import { moveBlock, newBlock, parseBlocks } from "@/server/domain/content/blocks";
import { PAGE_DEFAULTS } from "@/server/domain/content/defaults";
import {
  CONSENT_POLICY_VERSION,
  parseConsentCookie,
  serializeConsent,
  truncateIp,
} from "@/server/domain/consent/consent";

describe("CMS blocks", () => {
  it("drops invalid blocks instead of failing", () => {
    expect(
      parseBlocks([
        { id: "a", type: "text", body: "Hi" },
        { id: "b", type: "script", body: "x" },
        null,
      ]),
    ).toEqual([{ id: "a", type: "text", heading: "", body: "Hi" }]);
  });

  it("rejects javascript: links", () => {
    expect(
      parseBlocks([
        { id: "c", type: "cta", heading: "h", label: "l", href: "javascript:alert(1)" },
      ]),
    ).toEqual([]);
  });

  it("moves blocks", () => {
    const blocks = [newBlock("text", "1"), newBlock("offers", "2")];
    expect(moveBlock(blocks, "2", -1).map((b) => b.id)).toEqual(["2", "1"]);
    expect(moveBlock(blocks, "2", 1).map((b) => b.id)).toEqual(["1", "2"]);
  });

  it("all default pages are valid", () => {
    for (const page of PAGE_DEFAULTS)
      expect(parseBlocks(page.blocks)).toHaveLength(page.blocks.length);
  });

  it("legal pages default to the placeholder instead of self-written legal text", () => {
    const legal = PAGE_DEFAULTS.filter((p) => p.kind === "legal");
    expect(legal.map((p) => p.slug)).toEqual(["impressum", "datenschutz", "agb", "widerruf"]);
    for (const p of legal)
      expect(JSON.stringify(p.blocks)).toContain("Text wird von Rechtstext-Dienst geliefert");
  });
});

describe("consent", () => {
  const state = {
    id: "8f14e45f-ceea-4ed3-a1d1-1a4b5b8a7c11",
    v: CONSENT_POLICY_VERSION,
    statistics: true,
    marketing: false,
  };

  it("round-trips the cookie and ignores outdated versions", () => {
    expect(parseConsentCookie(serializeConsent(state))).toEqual(state);
    expect(parseConsentCookie(encodeURIComponent(serializeConsent(state)))).toEqual(state);
    expect(parseConsentCookie(serializeConsent({ ...state, v: "old" }))).toBeNull();
    expect(parseConsentCookie("garbage")).toBeNull();
  });

  it("truncates IP addresses", () => {
    expect(truncateIp("203.0.113.42")).toBe("203.0.113.0");
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(truncateIp(null)).toBeNull();
  });
});
