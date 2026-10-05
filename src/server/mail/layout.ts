export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

interface Paragraph {
  text: string;
}

interface Action {
  label: string;
  url: string;
}

/** Minimal, accessible HTML mail layout shared by all transactional mails. */
export function renderMail(input: {
  subject: string;
  greeting: string;
  paragraphs: Paragraph[];
  action?: Action;
  footnote?: string;
}): MailContent {
  const paragraphsHtml = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p.text)}</p>`)
    .join("");
  const actionHtml = input.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.action.url)}" style="background:#3f6f5e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(input.action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b6259">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>${escapeHtml(input.action.url)}</p>`
    : "";
  const footnoteHtml = input.footnote
    ? `<p style="margin:24px 0 0;font-size:13px;color:#6b6259">${escapeHtml(input.footnote)}</p>`
    : "";

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;background:#faf8f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#3a332d;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 24px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6259">Seelenzeit</p>
<p style="margin:0 0 16px">${escapeHtml(input.greeting)}</p>
${paragraphsHtml}${actionHtml}
<p style="margin:24px 0 0">Herzlich<br>dein Seelenzeit-Team</p>
${footnoteHtml}
</div></body></html>`;

  const text = [
    input.greeting,
    "",
    ...input.paragraphs.flatMap((p) => [p.text, ""]),
    ...(input.action ? [`${input.action.label}: ${input.action.url}`, ""] : []),
    "Herzlich",
    "dein Seelenzeit-Team",
    ...(input.footnote ? ["", input.footnote] : []),
  ].join("\n");

  return { subject: input.subject, html, text };
}
