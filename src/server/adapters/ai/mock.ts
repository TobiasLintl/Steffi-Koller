import type { AiAdapter } from "./types";

/** Deterministic stand-in until a provider is approved (DECISION D-06). */
export function createMockAiAdapter(now: () => Date = () => new Date()): AiAdapter {
  return {
    async draftReport(request) {
      return {
        content: `Entwurf (Mock) für ${request.subjectId}`,
        model: "mock",
        promptVersion: request.promptVersion,
        createdAt: now(),
      };
    },
  };
}
