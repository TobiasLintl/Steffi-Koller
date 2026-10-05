# Betriebshandbuch – Seelenzeit Plattform

Dieses Dokument beschreibt den Betrieb: E-Mail-Zustellung, Hintergrundjobs, Reseller, Medien,
Backups und Deployment. Es richtet sich an die Betreiberin und an technische Unterstützung.

---

## 1. E-Mail-Zustellung (Brevo)

Die Plattform verschickt **transaktionale Mails** (Zugang, Anmeldelink, Passwort, Modulfreischaltung,
Ablauf-Erinnerungen, Support) über die Brevo-API. **Newsletter** werden ausschließlich im
Newsletter-Dienst versendet; die Plattform überträgt nur Kontakte mit bestätigtem Double-Opt-in.

### 1.1 Einrichtung in Brevo
1. Brevo-Konto anlegen, AV-Vertrag abschließen.
2. *Senders, Domains & Dedicated IPs → Domains*: `seelenzeit.de` hinzufügen und verifizieren.
3. Absender anlegen: `kundenservice@seelenzeit.de` (transaktional) und `newsletter@seelenzeit.de` (Newsletter).
4. *SMTP & API → API Keys*: Schlüssel erzeugen → `BREVO_API_KEY`.
5. *Contacts → Lists*: Liste „Newsletter“ anlegen, ID notieren → `BREVO_NEWSLETTER_LIST_ID`.
6. In `.env`: `MAIL_DRIVER=brevo`, `NEWSLETTER_DRIVER=brevo`.

### 1.2 DNS-Einträge (beim Domain-Anbieter)
Die genauen Werte zeigt Brevo bei der Domain-Verifizierung an. Typisch:

| Typ | Name | Wert (Beispiel) | Zweck |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` | SPF: Brevo darf für die Domain senden. **Nur ein SPF-Eintrag pro Domain** – vorhandene `include:` (z. B. des Postfach-Anbieters) in denselben Eintrag aufnehmen. |
| TXT oder CNAME | `brevo._domainkey` | von Brevo vorgegeben | DKIM: Signatur der Mails |
| TXT | `@` | `brevo-code:…` | Domain-Verifizierung bei Brevo |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@seelenzeit.de; adkim=r; aspf=r` | DMARC: Start im Beobachtungsmodus |

**DMARC schrittweise verschärfen:** Nach 2–4 Wochen ohne Auffälligkeiten in den Berichten
`p=quarantine`, später `p=reject` setzen.

**Prüfen:** Testmail an ein Gmail-Konto schicken → „Original anzeigen“ → SPF, DKIM und DMARC müssen
`PASS` zeigen. Alternativ https://www.mail-tester.com.

### 1.3 Entwicklung ohne Brevo
`MAIL_DRIVER=log` und `NEWSLETTER_DRIVER=log` schreiben Mails bzw. Newsletter-Synchronisationen ins
Server-Log (Empfängeradresse maskiert). Anmeldelinks erscheinen dort im Klartext – nur lokal nutzen.

---

## 2. Hintergrundjobs (Worker)

Der Worker läuft als eigener Prozess (`pnpm worker`, in Produktion eigener Container) und nutzt
pg-boss (Schema `pgboss` in derselben Datenbank). Zugangsrechte hängen **nicht** von Jobs ab – Drip
wird beim Abruf berechnet; Jobs verschicken nur Benachrichtigungen.

| Job | Zeitplan (Europe/Berlin) | Aufgabe |
|---|---|---|
| `drip-notifications` | täglich 07:00 | Mail, wenn ein Modul per Drip freigeschaltet wurde |
| `expiry-reminders` | täglich 08:00 | Erinnerung 30 und 7 Tage vor Ablauf mit Verlängerungslink |
| `newsletter-sync` | alle 15 Min. | bestätigte Newsletter-Kontakte zu Brevo übertragen (Wiederholung bei Fehlern) |

Jeder Versand wird in `email_log` (ohne Mailadresse) mit Deduplizierungsschlüssel protokolliert –
ein Job kann gefahrlos mehrfach laufen. Einen Job sofort ausführen: `pnpm job expiry-reminders`.
