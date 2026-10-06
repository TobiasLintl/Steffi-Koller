import { existsSync } from "node:fs";

/** Test database URL: DATABASE_URL_TEST, or DATABASE_URL with the database name suffixed `_test`. */
export function testDatabaseUrl(): string {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or DATABASE_URL_TEST for integration tests");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  return url.toString();
}
