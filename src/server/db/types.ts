import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/** Database or transaction handle. Services take this instead of importing the singleton. */
export type DbExecutor = PgDatabase<PgQueryResultHKT, typeof schema>;
