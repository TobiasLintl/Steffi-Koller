import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

// Fictional test data only – never real customer data (CLAUDE.md §6).
// M1 adds an admin user and fictional customers here.
async function main() {
  console.log("Nothing to seed yet.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
