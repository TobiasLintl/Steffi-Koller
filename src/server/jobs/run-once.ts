import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

/** Runs one job immediately, e.g. `pnpm job expiry-reminders`. */
async function main() {
  const name = process.argv[2];
  const { jobDefinitions } = await import("./definitions");
  const job = jobDefinitions().find((j) => j.name === name);
  if (!job) {
    console.error(
      `Unknown job. Available: ${jobDefinitions()
        .map((j) => j.name)
        .join(", ")}`,
    );
    process.exit(1);
  }
  console.info(JSON.stringify(await job.run()));
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
