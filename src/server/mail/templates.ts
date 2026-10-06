import { renderMail, type MailContent } from "./layout";

function greeting(name?: string | null): string {
  return name ? `Hallo ${name},` : "Hallo,";
}

export function magicLinkMail(input: { url: string; name?: string | null }): MailContent {
  return renderMail({
    subject: "Dein Anmeldelink für Seelenzeit",
    greeting: greeting(input.name),
    paragraphs: [{ text: "hier ist dein persönlicher Link, um dich bei Seelenzeit anzumelden." }],
    action: { label: "Jetzt anmelden", url: input.url },
    footnote:
      "Der Link ist 10 Minuten gültig und funktioniert nur einmal. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.",
  });
}

export function passwordResetMail(input: { url: string; name?: string | null }): MailContent {
  return renderMail({
    subject: "Neues Passwort für Seelenzeit",
    greeting: greeting(input.name),
    paragraphs: [{ text: "du möchtest ein neues Passwort festlegen? Kein Problem." }],
    action: { label: "Passwort neu festlegen", url: input.url },
    footnote:
      "Der Link ist 24 Stunden gültig. Wenn du kein neues Passwort angefordert hast, ignoriere diese E-Mail – dein bisheriges Passwort bleibt bestehen.",
  });
}

export function emailVerificationMail(input: { url: string; name?: string | null }): MailContent {
  return renderMail({
    subject: "Bitte bestätige deine E-Mail-Adresse",
    greeting: greeting(input.name),
    paragraphs: [
      {
        text: "schön, dass du da bist! Bitte bestätige kurz deine E-Mail-Adresse, damit wir dein Konto aktivieren können.",
      },
    ],
    action: { label: "E-Mail-Adresse bestätigen", url: input.url },
  });
}

export function staffInviteMail(input: { url: string; roleLabel: string }): MailContent {
  return renderMail({
    subject: "Einladung in den Seelenzeit-Adminbereich",
    greeting: greeting(),
    paragraphs: [
      {
        text: `du wurdest als „${input.roleLabel}“ in den Adminbereich von Seelenzeit eingeladen.`,
      },
      {
        text: "Bitte lege über den Link ein Passwort fest (der Link ist 24 Stunden gültig). Danach richtest du die Zwei-Faktor-Anmeldung mit einer Authenticator-App ein.",
      },
    ],
    action: { label: "Passwort festlegen", url: input.url },
  });
}

export function accessGrantedMail(input: {
  courseTitle: string;
  url: string;
  name?: string | null;
  expiresAt?: Date | null;
}): MailContent {
  const until = input.expiresAt
    ? `Dein Zugang ist gültig bis ${formatDate(input.expiresAt)}.`
    : "Dein Zugang ist unbegrenzt gültig.";
  return renderMail({
    subject: `Dein Zugang zu „${input.courseTitle}“`,
    greeting: greeting(input.name),
    paragraphs: [
      {
        text: `danke für dein Vertrauen! Dein Kurs „${input.courseTitle}“ ist ab sofort für dich freigeschaltet.`,
      },
      { text: until },
      {
        text: "Über den Button gelangst du direkt in deinen Kursbereich. Falls du noch kein Passwort hast, schicken wir dir dort einfach einen Anmeldelink.",
      },
    ],
    action: { label: "Zu meinem Kurs", url: input.url },
  });
}

export function accessExtendedMail(input: {
  courseTitle: string;
  url: string;
  name?: string | null;
  expiresAt: Date;
}): MailContent {
  return renderMail({
    subject: `Verlängert: „${input.courseTitle}“`,
    greeting: greeting(input.name),
    paragraphs: [
      { text: `dein Zugang zu „${input.courseTitle}“ wurde verlängert.` },
      { text: `Du kannst den Kurs jetzt bis ${formatDate(input.expiresAt)} nutzen.` },
    ],
    action: { label: "Weiterlernen", url: input.url },
  });
}

export function moduleUnlockedMail(input: {
  courseTitle: string;
  moduleTitle: string;
  url: string;
  name?: string | null;
}): MailContent {
  return renderMail({
    subject: `Neues Modul: „${input.moduleTitle}“`,
    greeting: greeting(input.name),
    paragraphs: [
      {
        text: `in deinem Kurs „${input.courseTitle}“ ist ein neues Modul für dich freigeschaltet: „${input.moduleTitle}“.`,
      },
      { text: "Nimm dir Zeit dafür, wann immer es für dich passt." },
    ],
    action: { label: "Modul ansehen", url: input.url },
  });
}

export function expiryReminderMail(input: {
  courseTitle: string;
  daysLeft: number;
  expiresAt: Date;
  extendUrl: string | null;
  name?: string | null;
}): MailContent {
  return renderMail({
    subject: `Dein Zugang zu „${input.courseTitle}“ endet bald`,
    greeting: greeting(input.name),
    paragraphs: [
      {
        text: `nur zur Erinnerung: Dein Zugang zu „${input.courseTitle}“ endet in ${input.daysLeft} Tagen, am ${formatDate(input.expiresAt)}.`,
      },
      {
        text: input.extendUrl
          ? "Wenn du dir mehr Zeit wünschst, kannst du deinen Zugang einmalig verlängern – ohne Abo, ohne automatische Verlängerung."
          : "Nutze die verbleibende Zeit gern noch für dich.",
      },
    ],
    action: input.extendUrl ? { label: "Zugang verlängern", url: input.extendUrl } : undefined,
  });
}

export function newsletterConfirmationMail(input: {
  url: string;
  unsubscribeUrl?: string;
}): MailContent {
  return renderMail({
    subject: "Bitte bestätige deine Newsletter-Anmeldung",
    greeting: greeting(),
    paragraphs: [
      {
        text: "du hast dich für den Seelenzeit-Newsletter angemeldet. Bitte bestätige deine Anmeldung mit einem Klick.",
      },
      {
        text: "Erst nach deiner Bestätigung schicken wir dir Post. Abmelden kannst du dich jederzeit.",
      },
    ],
    action: { label: "Anmeldung bestätigen", url: input.url },
    footnote: `Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail – dann passiert nichts.${
      input.unsubscribeUrl
        ? ` Später abmelden kannst du dich jederzeit hier: ${input.unsubscribeUrl}`
        : ""
    }`,
  });
}

export function adminNotificationMail(input: {
  title: string;
  body: string;
  url: string;
}): MailContent {
  return renderMail({
    subject: `[Seelenzeit Admin] ${input.title}`,
    greeting: greeting(),
    paragraphs: [{ text: input.body }],
    action: { label: "Im Adminbereich öffnen", url: input.url },
  });
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "Europe/Berlin" }).format(
    date,
  );
}
