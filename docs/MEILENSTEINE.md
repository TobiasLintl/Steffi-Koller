# Meilensteinplan – Seelenzeit Plattform

Ablage im Projekt: `docs/MEILENSTEINE.md`. Fachliche Regeln stehen in `CLAUDE.md`.
Jeder Meilenstein endet mit grünen Tests und einem lauffähigen Stand.
Status: ⬜ offen · 🟨 in Arbeit · ✅ fertig

---

## Vor dem Start: Was die Betreiberin selbst erledigen muss

Diese Punkte kann Claude Code nicht übernehmen. Sie sollten parallel zu M0–M2 laufen.

- [ ] GitHub-Konto + privates Repository `seelenzeit-platform`
- [ ] Hetzner-Cloud-Konto (Server später in M9, Object Storage ab M4)
- [ ] Bunny.net-Konto, Stream-Library anlegen (ab M4)
- [ ] Brevo-Konto, Domain seelenzeit.de verifizieren (ab M6)
- [ ] CopeCart **und** Digistore24 Verkäuferkonto, je ein Testprodukt anlegen (ab M3)
- [ ] Rechtstext-Dienst wählen (z. B. IT-Recht Kanzlei, eRecht24, Händlerbund) (ab M5)
- [ ] AV-Verträge mit Hetzner, Bunny, Brevo abschließen
- [ ] Offene Entscheidungen D-01 (Storno-Regel) und D-03 (Drip bei Verlängerung) klären
- [ ] Lokal installieren: Git, Node.js LTS, pnpm, Docker Desktop, Claude Code

---

## Stufe 1 – MUSS zum Start

### M0 – Projektgrundlage ✅
**Ziel:** Leeres, sauberes Projekt, das lokal läuft.
- Next.js + TypeScript strict + Tailwind + shadcn/ui
- Docker Compose mit PostgreSQL, Drizzle eingerichtet
- Lint, Prettier, Vitest, Playwright, `.env.example`
- Verzeichnisstruktur laut CLAUDE.md §4, leere Adapter-Interfaces
- GitHub Actions: Lint + Typecheck + Tests bei jedem Push

**Fertig wenn:** `pnpm dev` zeigt Startseite, `pnpm test` läuft grün, CI grün.

> Prompt: *„Lies CLAUDE.md und setze Meilenstein M0 aus docs/MEILENSTEINE.md um.“*

---

### M1 – Datenmodell, Login, Rollen ✅
**Ziel:** Nutzer können sich registrieren und anmelden, Rollen greifen.
- Schema: `users`, `customer_profiles` (B2C/B2B, Land, Firma, USt-IdNr.), `roles`,
  `audit_log`
- Better Auth: E-Mail/Passwort, Magic Link, Passwort-Reset, TOTP-2FA
- 2FA-Pflicht für alle Rollen außer `customer`
- Zentrale Permission-Datei, Middleware für `/admin` und `/konto`
- Seed: Admin-Nutzer + fiktive Kunden

**Abnahme:** AK-12 (Grundgerüst: jede Rolle sieht nur erlaubte Routen)

---

### M2 – Kurse, Zugänge, Drip ✅
**Ziel:** Kernlogik der Lernplattform, zunächst ohne Zahlung (manuelle Freischaltung).
- Schema: `products`, `courses`, `modules`, `lessons`, `entitlements`, `entitlement_events`,
  `lesson_progress`
- Domänenlogik: Zugang erteilen, Ablauf berechnen, Verlängerung (`max(expires_at, now) + x`),
  Sperren, Drip-Freischaltung
- Mitgliederbereich: „Meine Kurse“ (aktiv/abgelaufen), Kursansicht, Lektion, Fortschritt
- Admin minimal: Kunde suchen, Zugang manuell freischalten/verlängern/sperren (mit Auditlog)

**Abnahme:** AK-05, AK-06, AK-07

---

### M3 – Reseller-Anbindung (Webhook) ✅
**Ziel:** Ein echter Testkauf schaltet automatisch frei.
- Payment-Adapter-Interface + **CopeCart-Adapter** (Digistore24 als zweiter Adapter danach)
- `POST /api/webhooks/copecart`: Signaturprüfung, Rohpayload in `webhook_events`,
  idempotente Verarbeitung
- Schema: `orders` (Provider, Transaktions-ID, Preis, Währung, Land, B2B-Daten, Belegreferenz)
- Kauf → Konto anlegen/zuordnen → Entitlement → Zugangsmail (vorerst Log-Ausgabe)
- Verlängerungsprodukt → bestehendes Entitlement verlängern
- Refund/Chargeback → Policy D-01
- Produktzuordnung Reseller-Produkt-ID ↔ internes Produkt im Admin pflegbar
- Testfixtures für alle Event-Typen inkl. CHF und B2B

**Abnahme:** AK-01, AK-02, AK-03 (Fixture), AK-04, AK-06 (per Webhook)
**Manuell:** Echter Testkauf bei CopeCart über Tunnel (z. B. `cloudflared`) auf lokale Instanz.

---

### M4 – Medien: Video, PDF, Audio ✅
**Ziel:** Geschützte Kursinhalte.
- Video-Adapter + Bunny-Stream-Implementierung: Upload aus Admin, Token-signierte
  Wiedergabe-URLs, Untertitel (VTT), Transkript-Feld pro Lektion
- Storage-Adapter (S3-kompatibel): private Buckets, signierte URLs (10 min)
- Flag `download_allowed` je Medium, Admin-Schalter
- Player mobil/desktop getestet

**Abnahme:** AK-08, AK-09, MED-01 bis MED-05

---

### M5 – Öffentliche Website, Rechtliches, Consent ⬜
**Ziel:** Vollständiger öffentlicher Auftritt.
- Startseite, Über mich, Angebotsübersicht, Produktseiten mit Kaufen-Button (Reseller-Link)
- Lead-Magnet-Seite (Giveaway), FAQ, Kontaktformular
- Rechtstextseiten (Inhalte vom Rechtstext-Dienst, per Admin oder Einbindung pflegbar)
- Consent-Banner (Kategorien: notwendig / Statistik / Marketing), Nachweis gespeichert
- Inhalte der Seiten im Admin pflegbar (einfaches CMS: Textblöcke, Bilder)
- SEO-Grundlagen: Meta-Tags, Sitemap, OpenGraph

**Abnahme:** Lighthouse mobil ≥ 90 (Performance/Accessibility), keine Tracking-Requests ohne Consent

---

### M6 – E-Mail und Newsletter ⬜
**Ziel:** Zuverlässige Kommunikation.
- Mail-Adapter (Brevo): Zugang, Passwort, Modulfreischaltung, Ablauf-Erinnerung
  (z. B. 30 und 7 Tage vorher, mit Verlängerungslink), Support
- Jobs mit pg-boss für zeitgesteuerte Mails
- Newsletter-Anmeldung mit Double-Opt-in, Speicherung Zeitstempel + Textversion,
  Abmeldung, Sync zu Brevo nur bei bestätigtem DOI
- DNS-Anleitung SPF/DKIM/DMARC in `docs/BETRIEB.md`

**Abnahme:** AK-10

---

### M7 – Adminbereich vollständig ⬜
**Ziel:** Betreiberin pflegt alles ohne Code.
- Produkte & Preise, Kurse/Module/Lektionen (Sortierung per Drag & Drop), Drip-Regeln
- Medien zuordnen, Download-Schalter
- Gutscheine/Rabattcodes (Hinweis: Einlösung erfolgt beim Reseller – hier nur Verwaltung
  und Zuordnung, sofern Reseller-API es erlaubt)
- Kundensuche + Kundenakte (Stammdaten, Käufe, Zugänge, Fortschritt, DOI-Status,
  Supportnotizen)
- Mitarbeiter einladen, Rollen vergeben
- Auditlog-Ansicht mit Filter
- Kennzahlen-Dashboard: Leads, Käufe, Umsatz je Produkt, Rückerstattungen, Kursstarts,
  Fortschritt, Verlängerungen

**Abnahme:** AK-12 vollständig (Integrationstest je Rolle)

---

### M8 – Export, Löschung, Backup ⬜
**Ziel:** Datenhoheit und Ausfallsicherheit.
- Export (CSV + JSON): Kunden, Käufe, Berechtigungen, Einwilligungen
- Kunden-Selbstauskunft (DSGVO Art. 15) als Download im Konto
- Konto löschen/anonymisieren mit Aufbewahrungslogik
- Backup-Skript: nächtlicher `pg_dump` verschlüsselt in externen Objektspeicher,
  Aufbewahrung 30 Tage
- Restore-Skript + dokumentierter Restore-Test

**Abnahme:** AK-13, AK-14

---

### M9 – Deployment und Go-Live ⬜
**Ziel:** Produktivbetrieb auf seelenzeit.de.
- Hetzner-Server (Empfehlung: mind. CX32), Docker Compose, Caddy mit automatischem HTTPS
- Staging-Umgebung (Subdomain) + Produktion
- Monitoring: Uptime-Check, Fehler-Logging, Backup-Erfolgskontrolle
- Security-Header prüfen, Abhängigkeiten auf Schwachstellen prüfen
- `docs/BETRIEB.md`: Updates, Restore, Notfallkontakte
- **Externe Prüfung:** Sicherheits-/Code-Review durch Entwickler (empfohlen, wenige Stunden)
- Echte Testkäufe in EUR, CHF, B2B; Rückerstattung durchspielen

**Abnahme:** Alle AK-01 bis AK-14 auf Staging bestanden, Testkäufe dokumentiert.

---

## Stufe 2 – SOLL (nach Start)

| M | Inhalt | Abnahme |
|---|---|---|
| M10 | Einstiegstest mit Produktempfehlung (ohne Diagnose-Sprache) | Empfehlung je Antwortprofil getestet |
| M11 | Fragebögen mit Versionierung + regelbasiertem Scoring, Datentrennung per `subject_id` | ARC-04 technisch nachgewiesen |
| M12 | KI-Berichtsentwurf (Adapter, pseudonymisiert) + Freigabe-Workflow, Prompt-Versionierung | AK-11 |
| M13 | PWA (Manifest, Service Worker, Install-Hinweis) | ARC-05 |
| M14 | Automatisierte Verlängerungsangebote, erweiterte Analytics (nur mit Consent) | – |
| M15 | 1:1-Coaching: Produkt + Terminbuchung (z. B. Cal.com-Anbindung) + Zoom-Link | – |
| M16 | Digistore24-Adapter (falls nicht in M3 gewählt) als Ausweichlösung | AK-01–04 mit DS24-Fixtures |

## Stufe 3 – KANN (später)
Native App · Offline-Inhalte · Community · Gamification · B2B-Seat-Lizenzen ·
erweiterte Mitarbeiter-Workflows · Enterprise-DRM

---

## Tipps für die Arbeit mit Claude Code

- Pro Meilenstein eine eigene Sitzung starten. Erster Satz immer:
  *„Lies CLAUDE.md und setze Meilenstein Mx um. Zeig mir zuerst deinen Plan.“*
- Große Meilensteine (M3, M7) in Teilaufgaben zerlegen lassen und einzeln abnehmen.
- Nach jedem Meilenstein selbst durchklicken (Handy + Desktop), dann committen.
- Fehlermeldungen vollständig zurückgeben, nicht zusammenfassen.
- Wenn Claude bei einer offenen Entscheidung (D-xx) fragt: Entscheidung treffen und in
  CLAUDE.md §9 nachtragen, damit sie für alle weiteren Sitzungen gilt.
