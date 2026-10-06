# syntax=docker/dockerfile:1
# Two images from one build: `app` (Next.js standalone) and `worker` (jobs, migrations, backups).

FROM node:22-alpine AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are compiled into the client bundle.
ARG NEXT_PUBLIC_APP_URL=https://www.seelenzeit.de
ARG NEXT_PUBLIC_STATISTICS_SCRIPT_URL=
ARG NEXT_PUBLIC_STATISTICS_DOMAIN=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STATISTICS_SCRIPT_URL=$NEXT_PUBLIC_STATISTICS_SCRIPT_URL \
    NEXT_PUBLIC_STATISTICS_DOMAIN=$NEXT_PUBLIC_STATISTICS_DOMAIN
RUN pnpm build

# --- Web application -------------------------------------------------------
FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]

# --- Worker: background jobs, migrations, backups ---------------------------
FROM base AS worker
# pg_dump/pg_restore must match the PostgreSQL 16 server.
RUN apk add --no-cache postgresql16-client
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN addgroup -S app && adduser -S app -G app && mkdir -p var && chown -R app:app var
USER app
CMD ["pnpm", "worker"]
