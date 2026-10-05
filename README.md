# Seelenzeit Plattform

Website, Shop-Anbindung, Kundenkonto, Lernplattform und Adminbereich für www.seelenzeit.de.

- Arbeitsgrundlage für Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Meilensteinplan und Status: [`docs/MEILENSTEINE.md`](docs/MEILENSTEINE.md)
- Betrieb, Deployment, Backups, Go-Live-Checkliste: [`docs/BETRIEB.md`](docs/BETRIEB.md)
- Pflichtenheft: [`docs/Seelenzeit_Pflichtenheft.docx`](docs/Seelenzeit_Pflichtenheft.docx)

## Funktionsumfang (Stufe 1)

| Bereich | Inhalt |
|---|---|
| Website | Startseite, Über mich, Angebote/Produktseiten (EUR/CHF, Kauf-Link zum Reseller), Gratis-Angebot, FAQ, Kontakt, Newsletter, Rechtstext-Seiten, Consent-Banner, Sitemap/SEO |
| Konto | Registrierung, Login (Passwort, Anmeldelink, 2FA optional), Meine Kurse (aktiv/abgelaufen), Lektionen mit Video/Audio/PDF, Fortschritt, Profil (B2C/B2B), Newsletter, Datenauskunft, Kontolöschung |
| Verkauf | CopeCart- und Digistore24-Webhooks (signiert, idempotent), Konto-Anlage/Zuordnung, Freischaltung, Verlängerung, Rückerstattung nach Regel (D-01) |
| Medien | Bunny Stream (Token-Auth), privater S3-Speicher mit 10-Min.-Links, Download-Schalter, Untertitel, Transkripte |
| Admin | Kennzahlen, Kundenakte, Käufe, Produkte & Preise, Kurs-Editor (Drag & Drop, Drip), Medien, Gutscheine, Seiten & FAQ, Nachrichten, Newsletter, Mitarbeiter (Rollen, 2FA-Pflicht), Auditlog, Export, Backups, Webhooks, Einstellungen |
| Betrieb | Worker (Drip-/Ablauf-Mails, Newsletter-Sync, Backups, Restore-Test, Aufbewahrungsfristen), Docker Compose + Caddy, Health-Checks |

## Lokal starten

Voraussetzungen: Node.js 22 LTS, pnpm, Docker Desktop (oder lokales PostgreSQL 16).

```bash
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 16 per Docker
pnpm db:migrate
pnpm db:seed        # fiktive Beispieldaten (Passwort aller Testkonten: seelenzeit-dev-123)
pnpm dev            # http://localhost:3000
pnpm worker         # optional: Hintergrundjobs
```

Testkonten nach `pnpm db:seed`: `kundin@example.test` (Kundin), `admin@example.test` (Admin, 2FA mit
festem Entwicklungs-Secret, siehe `src/server/db/seed.ts`), `neu@example.test` (Redaktion ohne 2FA).
Mails erscheinen lokal im Server-Log (`MAIL_DRIVER=log`).

## Prüfen

```bash
pnpm lint
pnpm typecheck
pnpm test           # Vitest: Unit + Integration (braucht PostgreSQL, nutzt <db>_test)
pnpm exec playwright install chromium   # einmalig
pnpm test:e2e       # Playwright, mobil + Desktop (braucht migrierte + geseedete DB)
```

## Weitere Befehle

| Befehl | Zweck |
|---|---|
| `pnpm db:generate` / `pnpm db:migrate` | Migration aus Schema erzeugen / anwenden |
| `pnpm worker` · `pnpm job <name>` | Worker starten · einzelnen Job sofort ausführen |
| `pnpm backup` · `pnpm backup verify` | Backup erstellen · Restore-Test |
| `pnpm admin:create <email> "<Name>"` | erstes Admin-Konto anlegen |
| `./scripts/deploy.sh [.env.staging]` | Deployment auf dem Server |
