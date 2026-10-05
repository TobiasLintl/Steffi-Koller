import { testDatabaseUrl } from "./test-db-url";

// Route all app code (lazy db singleton) to the test database.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.MAIL_DRIVER = "log";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.COPECART_WEBHOOK_SECRET = "cc-test-secret";
process.env.DIGISTORE24_IPN_PASSPHRASE = "ds-test-passphrase";
process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.test";
