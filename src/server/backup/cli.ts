import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Backup command line:
 *   pnpm backup                         – create a backup now
 *   pnpm backup list                    – list stored backups
 *   pnpm backup verify [key]            – restore test into a temporary database
 *   pnpm backup restore <key|latest> <targetDatabaseUrl> [--clean] --confirm
 */
async function main() {
  const [command = "create", ...args] = process.argv.slice(2);
  const { serverEnv } = await import("@/server/env");
  const { backupDeps } = await import("./registry");
  const { latestBackupKey, restoreBackup, runBackup, runRestoreTest, scriptDb } =
    await import("./run");
  const env = serverEnv();
  const deps = backupDeps(env);
  const { db, close } = scriptDb(env.DATABASE_URL);
  try {
    if (command === "create") {
      console.log(JSON.stringify(await runBackup(db, deps, { triggeredBy: "cli" })));
    } else if (command === "list") {
      for (const key of await deps.storage.list("backups/")) console.log(key);
    } else if (command === "verify") {
      const result = await runRestoreTest(db, deps, { key: args[0], triggeredBy: "cli" });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
    } else if (command === "restore") {
      const [keyArg, target] = args;
      if (!keyArg || !target || !args.includes("--confirm")) {
        console.error(
          "Usage: pnpm backup restore <key|latest> <targetDatabaseUrl> [--clean] --confirm",
        );
        process.exitCode = 2;
        return;
      }
      const key = keyArg === "latest" ? await latestBackupKey(deps.storage) : keyArg;
      if (!key) throw new Error("No backup found");
      await restoreBackup(deps, key, target, { clean: args.includes("--clean") });
      console.log(`Restored ${key}`);
    } else {
      console.error(`Unknown command ${command}`);
      process.exitCode = 2;
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
