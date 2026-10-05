# Seelenzeit Plattform

Website, Kundenkonto, Lernplattform und Adminbereich für www.seelenzeit.de.

- Arbeitsgrundlage für Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Meilensteinplan: [`docs/MEILENSTEINE.md`](docs/MEILENSTEINE.md)
- Pflichtenheft: [`docs/Seelenzeit_Pflichtenheft.docx`](docs/Seelenzeit_Pflichtenheft.docx)

## Lokal starten

Voraussetzungen: Node.js 22 LTS, pnpm, Docker Desktop.

```bash
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 16 per Docker
pnpm db:migrate
pnpm dev            # http://localhost:3000
```

## Prüfen

```bash
pnpm lint
pnpm typecheck
pnpm test           # Vitest (Unit/Integration)
pnpm exec playwright install chromium   # einmalig
pnpm test:e2e       # Playwright, mobil + Desktop
```
