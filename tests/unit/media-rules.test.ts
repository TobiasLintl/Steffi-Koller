import { describe, expect, it } from "vitest";

import {
  deliveryDisposition,
  isWebVtt,
  storageKeyFor,
  validateUpload,
} from "@/server/domain/media/rules";

describe("media rules", () => {
  it("MED-01: attachments only when download is allowed and requested", () => {
    expect(deliveryDisposition(false, true)).toBe("inline");
    expect(deliveryDisposition(true, false)).toBe("inline");
    expect(deliveryDisposition(true, true)).toBe("attachment");
  });

  it("validates types and sizes", () => {
    expect(validateUpload("pdf", "application/pdf", 1000)).toBeNull();
    expect(validateUpload("pdf", "text/html", 1000)).not.toBeNull();
    expect(validateUpload("audio", "audio/mpeg", 0)).not.toBeNull();
    expect(validateUpload("pdf", "application/pdf", 200 * 1024 * 1024)).not.toBeNull();
  });

  it("builds opaque storage keys", () => {
    expect(storageKeyFor("pdf", "abc", "application/pdf")).toBe("pdf/abc.pdf");
  });

  it("recognises WebVTT", () => {
    expect(isWebVtt("WEBVTT\n\n00:00.000 --> 00:01.000\nHallo")).toBe(true);
    expect(isWebVtt("1\n00:00:00,000 --> 00:00:01,000\nSRT")).toBe(false);
  });
});
