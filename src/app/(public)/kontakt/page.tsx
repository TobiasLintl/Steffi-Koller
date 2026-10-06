import type { Metadata } from "next";

import { ContactForm } from "@/components/site/contact-form";
import { sendContactAction } from "./actions";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Schreib uns – der Seelenzeit-Kundenservice hilft dir gern weiter.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Kontakt</h1>
        <p className="text-muted-foreground">
          Du hast eine Frage zu einem Kurs, deinem Zugang oder deinem Kauf? Schreib uns – wir
          antworten in der Regel innerhalb von zwei Werktagen.
        </p>
      </div>
      <ContactForm action={sendContactAction} />
    </main>
  );
}
