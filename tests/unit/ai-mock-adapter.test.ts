import { describe, expect, it } from "vitest";

import { createMockAiAdapter } from "@/server/adapters/ai";

describe("mock AI adapter", () => {
  it("returns a draft that carries model and prompt version", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const adapter = createMockAiAdapter(() => createdAt);

    const draft = await adapter.draftReport({
      subjectId: "subj_123",
      promptVersion: "v1",
      scores: {},
      answers: {},
    });

    expect(draft).toEqual({
      content: "Entwurf (Mock) für subj_123",
      model: "mock",
      promptVersion: "v1",
      createdAt,
    });
  });
});
