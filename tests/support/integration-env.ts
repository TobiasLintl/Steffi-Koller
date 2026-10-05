import { testDatabaseUrl } from "./test-db-url";

// Route all app code (lazy db singleton) to the test database.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.MAIL_DRIVER = "log";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
