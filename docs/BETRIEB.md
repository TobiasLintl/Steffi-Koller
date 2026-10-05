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
