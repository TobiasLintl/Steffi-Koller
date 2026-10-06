/**
 * AI report draft adapter (Stufe 2 – DECISION D-06: mock only until DPA review).
 * Input must be pseudonymised: no names, e-mails or addresses (CLAUDE.md §5.6).
 * Output is always a draft; publishing requires manual approval (AK-11).
 */

export interface ReportDraftRequest {
  /** Pseudonymous subject id, never a user id or e-mail. */
  subjectId: string;
  promptVersion: string;
  scores: Record<string, number>;
  answers: Record<string, string | number | boolean | string[]>;
}

export interface ReportDraft {
  content: string;
  model: string;
  promptVersion: string;
  createdAt: Date;
}

export interface AiAdapter {
  draftReport(request: ReportDraftRequest): Promise<ReportDraft>;
}
