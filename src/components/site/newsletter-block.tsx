import { NEWSLETTER_CONSENT_TEXT } from "@/server/domain/newsletter/rules";
import { NewsletterForm } from "./newsletter-form";

export function NewsletterBlock({ heading, body }: { heading: React.ReactNode; body: string }) {
  return (
    <section className="my-6 flex max-w-3xl flex-col gap-3 rounded-2xl border p-6 sm:p-8">
      {heading}
      {body ? <p className="text-muted-foreground">{body}</p> : null}
      <NewsletterForm consentText={NEWSLETTER_CONSENT_TEXT} />
    </section>
  );
}
