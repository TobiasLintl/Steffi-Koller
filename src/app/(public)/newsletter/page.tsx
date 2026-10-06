import type { Metadata } from "next";

import { NewsletterForm } from "@/components/site/newsletter-form";
import { NEWSLETTER_CONSENT_TEXT } from "@/server/domain/newsletter/rules";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Impulse und Neuigkeiten von Seelenzeit – mit Double-Opt-in, jederzeit abbestellbar.",
};

export default function NewsletterPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">Post von Seelenzeit</h1>
      <p className="text-muted-foreground">
        Gelegentliche Impulse, kleine Übungen und Neuigkeiten zu Kursen. Nach der Anmeldung bekommst
        du eine E-Mail mit einem Bestätigungslink – erst danach schicken wir dir den Newsletter.
      </p>
      <NewsletterForm consentText={NEWSLETTER_CONSENT_TEXT} />
    </main>
  );
}
