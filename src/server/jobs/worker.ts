import { existsSync } from "node:fs";

import { PgBoss } from "pg-boss";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Background worker: `pnpm worker` (runs as its own container in production).
 * Uses pg-boss with its own schema in the same PostgreSQL database.
 */
async function main() {
  const { jobDefinitions } = await import("./definitions");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const boss = new PgBoss({ connectionString: url, schema: "pgboss" });
  boss.on("error", (error) => console.error("[worker] pg-boss error", error));
  await boss.start();

  for (const job of jobDefinitions()) {
    await boss.createQueue(job.name);
    await boss.schedule(job.name, job.cron, null, { tz: "Europe/Berlin" });
    await boss.work(job.name, async () => {
      const started = Date.now();
      const result = await job.run();
      console.info(
        `[worker] ${job.name} done in ${Date.now() - started} ms`,
        JSON.stringify(result),
      );
      return result;
    });
    console.info(`[worker] scheduled ${job.name} (${job.cron})`);
  }

  const shutdown = async () => {
    console.info("[worker] stopping");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
