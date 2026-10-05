import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/server/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string, max = 10): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max });
  return { db: drizzle(client, { schema, casing: "snake_case" }), close: () => client.end() };
}

let instance: Db | undefined;

function getDb(): Db {
  instance ??= createDb(serverEnv().DATABASE_URL).db;
  return instance;
}

/** Lazily connected singleton, so importing this module never needs a database. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
