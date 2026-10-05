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

---

## 3. Backups und Wiederherstellung (AK-14)

### 3.1 Was wird gesichert?
- **Nächtlich 02:30 Uhr** (Job `backup`): vollständiger `pg_dump` (Custom-Format) der Datenbank,
  verschlüsselt mit AES-256-GCM (Schlüssel aus `BACKUP_ENCRYPTION_KEY`), abgelegt in einem
  **separaten** Objektspeicher (`BACKUP_S3_*`, idealerweise anderer Anbieter oder andere Region als
  der Server). Aufbewahrung: 30 Tage (`BACKUP_RETENTION_DAYS`), ältere Sicherungen werden gelöscht.
- **Sonntags 04:00 Uhr** (Job `restore-test`): das neueste Backup wird in eine temporäre Datenbank
  zurückgespielt, die Zeilenzahlen werden mit der Live-Datenbank verglichen, danach wird die
  temporäre Datenbank wieder entfernt. Ergebnis: Adminbereich → *Backups*.
- **Nicht** in der Datenbank: Videos (Bunny Stream) und PDFs/Audios (Objektspeicher). Für den
  Objektspeicher die Versionierung/Replikation des Anbieters aktivieren; Videos liegen zusätzlich als
  Originaldateien bei der Betreiberin.

> **Wichtig:** `BACKUP_ENCRYPTION_KEY` zusätzlich außerhalb des Servers aufbewahren (Passwortmanager).
> Ohne diesen Schlüssel sind die Backups wertlos.

### 3.2 Befehle
```bash
pnpm backup                 # Backup sofort erstellen
pnpm backup list            # gespeicherte Backups anzeigen
pnpm backup verify          # Restore-Test mit dem neuesten Backup (temporäre Datenbank)
pnpm backup restore latest postgres://user:pw@host:5432/zieldatenbank --confirm
```
In Produktion im Worker-Container ausführen: `docker compose exec worker pnpm backup verify`.

### 3.3 Notfall-Wiederherstellung (dokumentierter Ablauf)
1. Wartungsmodus: `docker compose stop app worker` (Website kurz offline).
2. Neue, leere Datenbank anlegen:
   `docker compose exec db createdb -U seelenzeit seelenzeit_restore`
3. Backup einspielen:
   `docker compose run --rm worker pnpm backup restore latest postgres://seelenzeit:…@db:5432/seelenzeit_restore --confirm`
4. Prüfen: `docker compose exec db psql -U seelenzeit seelenzeit_restore -c "select count(*) from users; select count(*) from orders;"`
5. Umschalten: `DATABASE_URL` auf `seelenzeit_restore` ändern (oder alte DB umbenennen:
   `ALTER DATABASE seelenzeit RENAME TO seelenzeit_alt; ALTER DATABASE seelenzeit_restore RENAME TO seelenzeit;`).
6. `docker compose up -d app worker`, Anmeldung und einen Kurs stichprobenartig prüfen.
7. Webhooks, die während der Ausfallzeit fehlschlugen, stellt der Reseller automatisch erneut zu
   (CopeCart: 10 Versuche in 3 Stunden). Längere Ausfälle: im Reseller-Konto IPNs erneut senden.

### 3.4 Restore-Test-Protokoll
| Datum | Backup | Ergebnis | Durchgeführt von |
|---|---|---|---|
| 2026-10-05 | `backups/seelenzeit-20261005-204800.dump.enc` (lokal) | erfolgreich, alle Zeilenzahlen identisch | Entwicklung (`pnpm backup verify`) |

Nach Go-Live mindestens quartalsweise einen manuellen Restore-Test auf Staging durchführen und hier
eintragen.

---

## 4. Datenschutz-Funktionen

- **Selbstauskunft (Art. 15 DSGVO):** Kundinnen laden unter *Mein Bereich → Meine Daten* alle
  gespeicherten Daten als JSON herunter.
- **Kontolöschung:** selbst (*Meine Daten*) oder durch Admin/Kundenservice (Kundenakte, mit
  Begründung). Persönliche Daten werden anonymisiert, Zugänge beendet, Newsletter-Kontakt beim
  Anbieter entfernt. Kaufdatensätze bleiben bis `retention_until` (10 Jahre) erhalten und werden dann
  vom Job `retention-purge` (täglich 03:15 Uhr) gelöscht.
- **Export (ARC-03):** Adminbereich → *Export*: Kunden, Käufe, Berechtigungen, Einwilligungen und
  Kursinhalte als CSV oder JSON. Jeder Export steht im Auditlog.

---

## 5. Server und Deployment (Hetzner Cloud)

### 5.1 Architektur
```
Internet ──443──▶ Caddy (HTTPS, Let's Encrypt) ──▶ app (Next.js, Port 3000)
                                                   │
                         worker (Jobs, Backups) ───┼──▶ PostgreSQL 16 (nur intern)
                                                   │
        Bunny Stream (Videos) · Hetzner Object Storage (PDF/Audio, Backups) · Brevo (Mail)
```
Alle Dienste laufen per Docker Compose (`docker-compose.prod.yml`). Die Datenbank ist von außen nicht
erreichbar. Logs: `docker compose logs -f app worker` (rotiert, 5 × 10 MB je Dienst).

### 5.2 Server einmalig einrichten
1. Hetzner Cloud: Server **CX32** (4 vCPU, 8 GB RAM), Standort Falkenstein/Nürnberg, Ubuntu 24.04,
   nur SSH-Schlüssel-Login. Hetzner-Firewall: eingehend nur 22 (eigene IP), 80, 443.
2. Auf dem Server:
   ```bash
   apt update && apt -y upgrade && apt -y install unattended-upgrades git curl
   curl -fsSL https://get.docker.com | sh
   adduser --disabled-password deploy && usermod -aG docker deploy
   ```
3. Als `deploy`: `git clone <repo> seelenzeit && cd seelenzeit && cp .env.production.example .env.production`
   und alle `CHANGE-ME`/leeren Werte befüllen (Secrets mit `openssl rand -base64 32`).
4. DNS beim Domain-Anbieter: `A`/`AAAA` für `www.seelenzeit.de` und `seelenzeit.de` auf die Server-IP.
5. Erster Start: `./scripts/deploy.sh` – Caddy holt die Zertifikate automatisch.
6. Admin-Konto anlegen (einmalig, danach Mitarbeitende im Adminbereich einladen):
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml run --rm worker \
     pnpm admin:create info@seelenzeit.de "Steffi Koller"
   ```
   Danach auf `https://www.seelenzeit.de/passwort-vergessen` die Adresse eingeben: Es kommt eine
   Einladungsmail zum Festlegen des Passworts. Beim ersten Öffnen des Adminbereichs wird die
   Zwei-Faktor-Anmeldung eingerichtet.

### 5.3 Staging
Eigener kleiner Server (CX22) mit identischem Setup und `.env.staging`:
`COMPOSE_PROJECT_NAME=seelenzeit-staging`, `SITE_DOMAIN=staging.seelenzeit.de`,
`CADDYFILE=./deploy/Caddyfile.staging`, `STAGING_USER`/`STAGING_PASSWORD_HASH` (Passwortschutz,
`noindex`). Reseller-Testprodukte zeigen mit ihrer IPN-URL auf Staging (Webhooks sind vom Passwort
ausgenommen). Deploy: `./scripts/deploy.sh .env.staging`.

### 5.4 Updates und Rollback
- **Update:** `./scripts/deploy.sh` (erstellt vorher ein Backup, baut die Images mit Git-Hash als Tag,
  führt Migrationen aus, startet neu, prüft `/api/health`).
- **Rollback (Code):** `git checkout <vorheriger-tag> && ./scripts/deploy.sh`. Migrationen sind
  vorwärtsgerichtet; enthält das fehlerhafte Release eine Migration, Datenbank aus dem Backup vor dem
  Deployment wiederherstellen (§3.3).
- **Abhängigkeiten:** monatlich `pnpm outdated` und `pnpm audit --prod` prüfen; CI blockiert
  bekannte Lücken ab Schweregrad „high“. Docker-Basis-Images werden bei jedem Deployment neu gezogen.

### 5.5 Monitoring
| Prüfung | URL / Ort | Erwartung |
|---|---|---|
| Erreichbarkeit | `https://www.seelenzeit.de/api/health` | 200 alle 1–5 Min. (z. B. UptimeRobot, Better Stack) |
| Backup-Erfolg | `https://www.seelenzeit.de/api/health/backup` | 200; 503, wenn das letzte Backup älter als 36 h ist |
| Fehler | `docker compose logs app worker` | Fehlgeschlagene Webhooks erscheinen zusätzlich als Admin-Benachrichtigung und per Mail an `ADMIN_NOTIFICATION_EMAIL` |
| Zertifikate | Caddy erneuert automatisch | – |

### 5.6 Sicherheit (Checkliste vor Go-Live)
- [ ] Security-Header prüfen: https://securityheaders.com (erwartet A/A+; CSP mit Nonce, HSTS, `X-Frame-Options: DENY`)
- [ ] SSL Labs: https://www.ssllabs.com/ssltest/ (erwartet A/A+)
- [ ] `pnpm audit --prod` ohne high/critical
- [ ] Alle Mitarbeitenden haben 2FA aktiv (Adminbereich → Mitarbeiter)
- [ ] `.env.production` nur für `deploy` lesbar (`chmod 600`), Secrets zusätzlich im Passwortmanager
- [ ] Externe Prüfung: Sicherheits-/Code-Review durch eine Entwicklerin/einen Entwickler (wenige Stunden),
      Schwerpunkte: Webhook-Verarbeitung, Autorisierung, Medienauslieferung, Löschkonzept

---

## 6. Externe Dienste einrichten

### 6.1 Hetzner Object Storage (PDF/Audio und Backups)
1. Zwei Buckets anlegen: `seelenzeit-media` und `seelenzeit-backups` (beide **privat**). Für Backups
   besser einen anderen Standort wählen als den Server.
2. Zugangsschlüssel erzeugen → `S3_*` bzw. `BACKUP_S3_*`.
3. CORS für den Medien-Bucket (Uploads im Adminbereich laden direkt in den Bucket):
   ```json
   [{ "AllowedOrigins": ["https://www.seelenzeit.de"], "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

### 6.2 Bunny Stream (Videos, D-04)
1. Stream-Library anlegen (Region EU), AV-Vertrag abschließen.
2. *API* → Library-ID und API-Key → `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`.
3. *Security*: **Embed View Token Authentication** aktivieren, Schlüssel → `BUNNY_STREAM_TOKEN_KEY`;
   **Allowed Referrers**: `www.seelenzeit.de` (Hotlink-Schutz, MED-04); „Direct Play“ deaktivieren;
   optional Wasserzeichen aktivieren.
4. *Encoding*: Auflösungen 360p–1080p (adaptives HLS, MED-03).
5. Test: Video im Adminbereich hochladen, Status „bereit“, in Lektion zuordnen, als Kundin abspielen;
   den iframe-Link in einem privaten Fenster nach Ablauf (`VIDEO_TOKEN_TTL_SECONDS`) erneut öffnen →
   muss abgelehnt werden (AK-09, manueller Test).

### 6.3 Reseller (CopeCart zuerst, D-02)
1. Produkte bei CopeCart anlegen (Preis EUR + CHF, B2B-Felder aktiv: Firma, USt-IdNr., Adresse).
2. *IPN*: URL `https://www.seelenzeit.de/api/webhooks/copecart`, Secret erzeugen →
   `COPECART_WEBHOOK_SECRET`. Für Digistore24: IPN-URL `…/api/webhooks/digistore24`, SHA-Passphrase
   → `DIGISTORE24_IPN_PASSPHRASE`.
3. Adminbereich → *Produkte*: je Produkt die Produkt-ID des Resellers zuordnen und den
   Checkout-Link als „Kauf-Link“ eintragen. Verlängerungsprodukte als eigene Produkte (Art
   „Verlängerung“).
4. Rückerstattungsregel (D-01) unter *Einstellungen* festlegen.

---

## 7. Go-Live: Abnahme auf Staging

Alle Punkte auf Staging durchspielen und Ergebnis + Datum eintragen.

| AK | Prüfung | Automatisiert | Manuell auf Staging |
|---|---|---|---|
| AK-01 | Testkauf (EUR) schaltet den richtigen Kurs frei, Zugangsmail kommt an | Integration + E2E | ☐ |
| AK-02 | Rückerstattung im Reseller auslösen → Zugang gesperrt, Admin informiert | Integration | ☐ |
| AK-03 | Testkauf in CHF | Integration (Fixture) | ☐ |
| AK-04 | B2B-Testkauf mit Firma + USt-IdNr. → in Kauf und Kundenakte sichtbar | Integration | ☐ |
| AK-05 | Ablauf 6/24 Monate (Kundenakte: Ablaufdatum prüfen) | Unit + Integration | ☐ |
| AK-06 | Verlängerungsprodukt kaufen → +3/+6 Monate, kein zweiter Eintrag | Unit + Integration | ☐ |
| AK-07 | Nicht gekaufte Kurse nicht erreichbar | E2E | ☐ |
| AK-08 | PDF ohne Download-Freigabe: Link läuft nach 10 Min. ab | Integration + E2E | ☐ |
| AK-09 | Video-Link ohne gültiges Token / von fremder Domain verweigert | Unit (Token) | ☐ |
| AK-10 | Newsletter erst nach DOI-Bestätigung in Brevo | Unit + Integration | ☐ |
| AK-11 | KI-Bericht (Stufe 2, M12) | – | – |
| AK-12 | Mitarbeiter sehen nur Daten ihrer Rolle | Unit + E2E je Rolle | ☐ |
| AK-13 | Export Kunden/Käufe/Berechtigungen/Einwilligungen/Kurse | Integration + E2E | ☐ |
| AK-14 | Backup wiederherstellen (`pnpm backup verify` + §3.3 einmal komplett) | Integration | ☐ |

Zusätzlich: Lighthouse mobil ≥ 90 (Startseite, Angebote, Produktseite), Rechtstexte eingepflegt,
Consent-Banner geprüft, Testkäufe dokumentiert (Datum, Produkt, Währung, Ergebnis).

---

## 8. Notfallkontakte

| Bereich | Kontakt | Zugang/Hinweis |
|---|---|---|
| Betreiberin | Steffi Koller – info@seelenzeit.de | Admin-Konto, Passwortmanager |
| Technische Betreuung | _bitte eintragen_ | SSH-Zugang `deploy@<server>` |
| Hetzner (Server, Storage) | https://console.hetzner.cloud · Support-Ticket | Konto der Betreiberin |
| Bunny.net | support@bunny.net | Dashboard |
| Brevo | https://help.brevo.com | Dashboard |
| CopeCart | support@copecart.com | Verkäuferkonto |
| Digistore24 | https://help.digistore24.com | Verkäuferkonto |
| Domain/DNS | _Anbieter eintragen_ | – |
