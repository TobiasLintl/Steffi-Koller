# CLAUDE.md – Seelenzeit Plattform

Diese Datei ist die verbindliche Arbeitsgrundlage für Claude Code in diesem Repository.
Fachliche Quelle: `docs/Seelenzeit_Pflichtenheft.docx` (Version 3.0, Stand 05.10.2026).
Umsetzungsreihenfolge: `docs/MEILENSTEINE.md`.

---

## 1. Projekt in einem Absatz

Seelenzeit (www.seelenzeit.de) ist eine mobile-first Plattform aus öffentlicher Website,
Shop-Anbindung, Kundenkonto, Lernplattform (LMS) und Adminbereich für vorproduzierte
Selbstlernkurse. Kurse sind **Einmalkäufe ohne Abo und ohne automatische Verlängerung**.
Verkauf, Rechnung und Umsatzsteuer übernimmt ein **Reseller** (CopeCart oder Digistore24),
der die Plattform per Webhook/IPN über Käufe informiert. Kundendaten, Berechtigungen und
Lernfortschritt liegen ausschließlich in **unserer eigenen Datenbank**. Zielmärkte: DE + CH,
EU technisch vorbereitet. Die Betreiberin pflegt alles über einen Adminbereich **ohne Code**.

---

## 2. Tech-Stack (Variante A aus dem Pflichtenheft)

| Bereich | Wahl | Hinweis |
|---|---|---|
| Sprache | TypeScript (strict) | kein `any` ohne Kommentar |
| Web/App | Next.js (App Router), React Server Components | Website + Mitgliederbereich + Admin in einer App |
| UI | Tailwind CSS + shadcn/ui | mobile-first, barrierearm |
| Datenbank | PostgreSQL 16 | lokal per Docker |
| ORM/Migrationen | Drizzle ORM + drizzle-kit | jede Schemaänderung als Migration |
| Auth | Better Auth (E-Mail + Passwort, Magic Link, TOTP-2FA) | 2FA für alle Nicht-Kunden-Rollen Pflicht |
| Validierung | Zod | an allen Systemgrenzen (Formulare, Webhooks, API) |
| Jobs/Cron | pg-boss (Queue in Postgres) | Drip-Mails, Ablauf-Erinnerungen, Backups |
| Video | Bunny Stream (Adapter) | Token-Auth, Hotlink-Schutz; Cloudflare Stream als Alternative |
| Dateien | S3-kompatibler EU-Objektspeicher (z. B. Hetzner Object Storage) | nur signierte, zeitlich begrenzte URLs |
| Transaktionale Mail | Brevo API/SMTP (Adapter) | |
| Newsletter | Brevo oder CleverReach (Adapter) | nur mit bestätigtem DOI |
| Tests | Vitest (Unit/Integration), Playwright (E2E) | |
| Deployment | Docker Compose auf Hetzner Cloud (EU), Caddy als Reverse Proxy | |
| PWA | Web App Manifest + Service Worker (Stufe 2) | |

Wenn eine Bibliothek ergänzt werden soll, die hier nicht steht: kurz begründen und erst nach
Rückfrage einführen.

---

## 3. Architekturprinzipien (nicht verhandelbar)

1. **Externe Dienste nur über Adapter.** Zahlung, Video, Dateispeicher, E-Mail, Newsletter und
   KI hängen jeweils hinter einem Interface in `src/server/adapters/<bereich>/`. Fachlogik
   importiert nie direkt ein Anbieter-SDK. Ein Anbieterwechsel darf keine Kurs- oder
   Kundendaten-Migration erfordern (ARC-02).
2. **Keine eigene Zahlungs-, Video- oder Mailserver-Infrastruktur.**
3. **Datentrennung (ARC-04):** Identitätsdaten (`users`, `customer_profiles`), Kaufdaten
   (`orders`, `entitlements`) und sensible Fragebogeninhalte (`questionnaire_responses`) liegen
   in getrennten Tabellen. Fragebogenantworten referenzieren nur eine pseudonyme `subject_id`,
   nie direkt E-Mail oder Name.
4. **Alles exportierbar (ARC-03):** Kunden, Käufe, Berechtigungen, Einwilligungen müssen als
   CSV/JSON exportierbar sein.
5. **Eigene Domain, kein Fremdbranding im Lernbereich (ARC-01).**
6. **Serverseitige Autorisierung überall.** Jede Abfrage auf Kurs-, Medien- oder Kundendaten
   prüft Rolle UND Berechtigung serverseitig. UI-Ausblenden ist kein Schutz.

---

## 4. Verzeichnisstruktur

```
src/
  app/                      # Next.js Routen
    (public)/               # Website, Produktseiten, Rechtstexte
    (account)/              # Kundenkonto / Mitgliederbereich
    admin/                  # Adminbereich (Rollen geschützt)
    api/webhooks/<provider>/ # Webhook-Endpunkte je Reseller
  server/
    domain/                 # reine Fachlogik (ohne Framework, gut testbar)
      access/               # Berechtigungen, Ablauf, Verlängerung, Drip
      orders/
      questionnaires/
    adapters/
      payment/  video/  storage/  mail/  newsletter/  ai/
    db/
      schema/               # Drizzle-Schema, nach Bereich getrennt
      migrations/
    auth/
    jobs/
    audit/
  components/
tests/
  unit/  integration/  e2e/
docs/
```

---

## 5. Fachregeln (Domäne)

### 5.1 Produkte und Zugang
| Stufe | Zugang ab Kauf | Verlängerung |
|---|---|---|
| Kostenlos | je Produkt konfigurierbar (auch unbegrenzt) | keine |
| Klein | 6 Monate | +3 Monate (kostenpflichtiger Kauf) |
| Mittel | 6 Monate | +3 Monate |
| Groß | 24 Monate, Module per Drip über 12 Monate | +6 Monate |
| Coaching (Stufe 2) | termin-/paketbezogen | neuer Kauf |

- Zugangsdauer und Verlängerungsdauer sind **pro Produkt im Admin konfigurierbar**, die Werte
  oben sind Defaults – nicht hart codieren.
- Ein Kunde hat pro Kurs **genau ein** `entitlement` mit `starts_at` und `expires_at`.
- **Verlängerung:** `expires_at = max(expires_at, now) + Verlängerungsdauer`. Kein zweiter
  Datensatz. Jede Änderung erzeugt einen Eintrag in `entitlement_events`.
- Abgelaufene Kurse bleiben im Konto sichtbar als „abgelaufen – verlängern“, Inhalte gesperrt.
- Nicht gekaufte Kurse: Inhalte nicht abrufbar (HTTP 403/404), nur Produktseite sichtbar.
- Manuell durch Admin: freischalten, verlängern, sperren – immer mit Begründung + Auditlog.

### 5.2 Drip
- Drip-Regel pro Modul: `unlock_after_days` relativ zu `entitlement.starts_at`.
- Freischaltung wird beim Abruf berechnet (keine Cron-Pflicht für die Berechtigung);
  Cron nur für Benachrichtigungsmails.
- **Offene Entscheidung D-03** (siehe §9): Verhalten bei Verlängerung vor Ende des Drips.
  Bis zur Klärung: Drip läuft unverändert ab `starts_at` weiter.

### 5.3 Kauf per Webhook
- Ablauf: Reseller-Webhook → Signatur/Passphrase prüfen → Rohpayload in `webhook_events`
  speichern → **idempotent** verarbeiten (Schlüssel: Provider + Transaktions-ID + Event-Typ)
  → Konto anlegen oder per E-Mail zuordnen → Entitlement anlegen/verlängern → Zugangsmail.
- Gespeichert pro Kauf: Provider, Transaktions-ID, Produkt, Preis, Währung (EUR/CHF),
  Käuferland, B2C/B2B, bei B2B Firma + Rechnungsanschrift + USt-IdNr., Belegreferenz.
- Doppelte oder verspätete Webhooks dürfen niemals doppelte Zugänge oder doppelte
  Verlängerungen erzeugen.
- Unbekannte Event-Typen: speichern, loggen, nicht crashen.
- **Rückerstattung/Storno/Chargeback:** Regel ist **offene Entscheidung D-01**. Bis zur Klärung
  als konfigurierbare Policy implementieren, Default: Entitlement sofort sperren
  (`status = revoked`), Event protokollieren, Admin benachrichtigen.

### 5.4 Medien
- Pro Medium (PDF, Audio, Video) Flag `download_allowed` (MED-01).
- Videos nur über Streaming mit signierten, zeitlich begrenzten Token (MED-02), adaptive
  Bitrate (MED-03), Untertitel (VTT) + Transkript pro Lektion (MED-05).
- PDFs/Audios: private Buckets; Auslieferung nur über signierte URLs mit kurzer Laufzeit
  (Default 10 min). Ohne `download_allowed` nur Inline-Ansicht/-Wiedergabe.
- Es darf **keine** dauerhafte öffentliche URL zu Kursmedien existieren.

### 5.5 E-Mail und Newsletter
- Transaktional (Zugang, Passwort, Modulfreischaltung, Erinnerungen, Support) und Newsletter
  strikt getrennt.
- Newsletter nur bei `consent.status = confirmed` (Double-Opt-in). Gespeichert: Zeitstempel
  Anmeldung, Zeitstempel Bestätigung, IP (gekürzt), Version des Einwilligungstextes.
- Absender: kundenservice@, newsletter@seelenzeit.de.

### 5.6 Fragebögen und KI-Berichte (Stufe 2)
- Ablauf: Fragebogen → regelbasierte Scores → optionaler KI-Entwurf → Prüfbereich →
  ändern/genehmigen → erst dann sichtbar für Kunden.
- **Ein KI-Bericht wird niemals automatisch veröffentlicht.** Status-Maschine:
  `draft → in_review → approved → published`. `published` nur aus `approved`, nur durch Rolle
  `report_approver` oder `admin`.
- Versioniert: Fragebogen, Auswertungslogik, Prompt. Gespeichert: KI-Modell, Prompt-Version,
  Zeitstempel Erstellung/Freigabe, freigebende Person.
- An den KI-Dienst nur pseudonymisierte Daten (keine Namen, E-Mails, Adressen).
- Keine Einstiegstests mit Diagnose-Sprache („Du hast …“) – nur Produktempfehlungen.

### 5.7 Rollen
| Rolle | Rechte |
|---|---|
| `customer` | eigene Daten, Käufe, Kurse, freigegebene Berichte |
| `admin` | alles |
| `support` | Stammdaten, Zugänge, Support – **keine** Fragebogeninhalte |
| `editor` | Kurse, Lektionen, Medien – keine Zahlungs-/Fragebogendaten |
| `accounting` | Käufe, Belegreferenzen, Export – keine Kurs-/Fragebogeninhalte |
| `report_approver` | nur Fragebogen-/Berichtsfreigabe |

Rechte als Permission-Liste pro Rolle in einer zentralen Datei
(`src/server/auth/permissions.ts`), nicht verstreut im Code.

---

## 6. Sicherheit und Datenschutz

- 2FA (TOTP) Pflicht für alle Rollen außer `customer`.
- Passwörter nur über die Auth-Bibliothek; keine eigene Kryptografie.
- **Auditlog** (`audit_log`, append-only) für: Zugangsänderungen, Rollenänderungen, Exporte,
  Berichtsfreigaben, Löschungen, Admin-Logins.
- Secrets nur in `.env` (nie committen); `.env.example` aktuell halten.
- Webhooks: Signaturprüfung, Rate-Limit, Payload-Größenlimit.
- Security-Header (CSP, HSTS, X-Frame-Options) über Next.js/Caddy.
- Kein Tracking ohne Consent. Analytics-Skripte erst laden, wenn Consent-Kategorie erteilt.
- Löschkonzept: Konto löschen = personenbezogene Daten anonymisieren; Kaufbelege nach
  gesetzlichen Aufbewahrungsfristen behalten (Feld `retention_until`).
- Keine echten Kundendaten in Tests, Seeds oder Logs. Logs ohne E-Mail/Name im Klartext.

---

## 7. Arbeitsweise für Claude Code

1. **Immer einen Meilenstein nach dem anderen** aus `docs/MEILENSTEINE.md`. Vor Beginn kurz
   den Plan nennen, dann umsetzen.
2. **Erst Fachlogik + Tests, dann UI.** Fachregeln aus §5 liegen in `src/server/domain/` und
   haben Unit-Tests.
3. **Nicht raten bei offenen Entscheidungen (§9).** Konfigurierbar bauen, Default wie
   angegeben, im Code mit `// DECISION D-xx` markieren.
4. **Jede Schemaänderung = Migration.** Niemals Daten in bestehenden Migrationen ändern.
5. **Kleine Commits** mit aussagekräftiger Nachricht (Deutsch oder Englisch, einheitlich).
6. Nach jedem Meilenstein: `pnpm lint && pnpm typecheck && pnpm test` grün, Abnahmekriterien
   des Meilensteins mit Tests belegt, `docs/MEILENSTEINE.md` Status aktualisieren.
7. UI-Texte auf Deutsch, Du-Ansprache (Seelenzeit-Tonalität: warm, klar, nicht esoterisch
   übertrieben). Code, Variablen und Kommentare auf Englisch.
8. Rechtstexte (Impressum, Datenschutz, AGB, Widerruf) **nicht selbst formulieren** – nur
   Platzhalterseiten mit Hinweis „Text wird von Rechtstext-Dienst geliefert“.

### Befehle
```
pnpm dev            # Entwicklungsserver
pnpm db:up          # Postgres per Docker starten
pnpm db:generate    # Migration aus Schema erzeugen
pnpm db:migrate     # Migrationen anwenden
pnpm db:seed        # Testdaten (fiktive Kunden/Kurse)
pnpm lint
pnpm typecheck
pnpm test           # Vitest
pnpm test:e2e       # Playwright
```

### Definition of Done (pro Feature)
- Fachlogik getestet, Autorisierung serverseitig geprüft und getestet
- Auditlog-Eintrag, wo §6 es verlangt
- Mobile Ansicht geprüft
- Keine offenen TypeScript-/Lint-Fehler
- Relevantes Abnahmekriterium (siehe Meilensteinplan) als Test vorhanden

---

## 8. Abnahmekriterien (aus Pflichtenheft Kap. 19)

| ID | Kriterium | Test |
|---|---|---|
| AK-01 | Nach Testkauf wird korrekter Kurs automatisch freigeschaltet | Integration (Webhook-Fixture) + E2E |
| AK-02 | Bei Rückerstattung/Storno wird Berechtigung nach Regel angepasst | Integration |
| AK-03 | Schweizer Kunde kann in CHF kaufen | Webhook-Fixture CHF + manueller Reseller-Test |
| AK-04 | B2B-Kunde kann Firmendaten angeben | Integration |
| AK-05 | Kleine/mittlere Kurse enden nach 6, großer nach 24 Monaten | Unit (Zeit gemockt) |
| AK-06 | Verlängerung erweitert um 3 bzw. 6 Monate, kein zweiter Datensatz | Unit + Integration |
| AK-07 | Nicht gekaufte Kurse unsichtbar/gesperrt | E2E + API-Test |
| AK-08 | Nicht freigegebene Downloads ohne dauerhafte öffentliche URL | Integration |
| AK-09 | Video-Streams gegen triviales Hotlinking geschützt | manueller Test + Token-Ablauf-Test |
| AK-10 | Newsletter ohne bestätigtes DOI wird nicht versendet | Unit |
| AK-11 | KI-Bericht ohne manuelle Freigabe nicht veröffentlichbar | Unit (Statusmaschine) |
| AK-12 | Mitarbeiter sehen nur Daten ihrer Rolle | Integration je Rolle |
| AK-13 | Vollständiger Kunden-/Kauf-/Kurs-/Einwilligungsexport möglich | Integration |
| AK-14 | Backup kann testweise wiederhergestellt werden | Skript + dokumentierter Restore |

---

## 9. Offene Entscheidungen

| ID | Frage | Default bis zur Klärung |
|---|---|---|
| D-01 | Regel bei Rückerstattung / Storno / Chargeback | Zugang sofort sperren, Admin benachrichtigen |
| D-02 | Reseller: CopeCart oder Digistore24 | Beide Adapter-Interfaces vorsehen, CopeCart zuerst implementieren |
| D-03 | Drip-Verhalten bei Verlängerung vor Drip-Ende | Drip unverändert ab `starts_at` |
| D-04 | Bunny Stream oder Cloudflare Stream | Bunny Stream |
| D-05 | Brevo oder CleverReach | Brevo |
| D-06 | KI-Anbieter (nach AVV-Prüfung) | Adapter mit Mock, kein echter Anbieter |
| D-07 | Zählen Fragebogendaten als Gesundheitsdaten (Art. 9 DSGVO)? | Wie Art.-9-Daten behandeln (ausdrückliche Einwilligung, Verschlüsselung at rest) |
| D-08 | Verfügbarkeit CHF beim gewählten Reseller | im Reseller-Test prüfen |
