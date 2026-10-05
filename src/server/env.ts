import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated on first use (not at import, so `next build` works
 * without secrets). Never read process.env directly in domain code.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    /** Only for local E2E runs; never disable in production. */
    AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),

    MAIL_DRIVER: z.enum(["log", "brevo"]).default("log"),
    BREVO_API_KEY: z.string().optional(),
    MAIL_FROM_SUPPORT: z.email().default("kundenservice@seelenzeit.de"),
    MAIL_FROM_NEWSLETTER: z.email().default("newsletter@seelenzeit.de"),
    MAIL_SENDER_NAME: z.string().default("Seelenzeit"),
    NEWSLETTER_DRIVER: z.enum(["log", "brevo"]).default("log"),
    BREVO_NEWSLETTER_LIST_ID: z.coerce.number().int().positive().optional(),
    ADMIN_NOTIFICATION_EMAIL: z.email().optional(),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default("./var/storage"),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default("eu-central"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
    MEDIA_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(600),

    VIDEO_DRIVER: z.enum(["local", "bunny"]).default("local"),
    BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
    BUNNY_STREAM_API_KEY: z.string().optional(),
    BUNNY_STREAM_TOKEN_KEY: z.string().optional(),
    VIDEO_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),

    BACKUP_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    BACKUP_DIR: z.string().default("./var/backups"),
    BACKUP_S3_ENDPOINT: z.url().optional(),
    BACKUP_S3_REGION: z.string().default("eu-central"),
    BACKUP_S3_BUCKET: z.string().optional(),
    BACKUP_S3_ACCESS_KEY_ID: z.string().optional(),
    BACKUP_S3_SECRET_ACCESS_KEY: z.string().optional(),
    BACKUP_ENCRYPTION_KEY: z.string().min(16).optional(),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    COPECART_WEBHOOK_SECRET: z.string().optional(),
    DIGISTORE24_IPN_PASSPHRASE: z.string().optional(),
  })
  .refine((env) => env.NODE_ENV !== "production" || Boolean(env.BETTER_AUTH_SECRET), {
    message: "BETTER_AUTH_SECRET is required in production",
    path: ["BETTER_AUTH_SECRET"],
  })
  .refine(
    (env) =>
      env.STORAGE_DRIVER !== "s3" ||
      Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
    {
      message:
        "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for STORAGE_DRIVER=s3",
      path: ["STORAGE_DRIVER"],
    },
  )
  .refine(
    (env) =>
      env.VIDEO_DRIVER !== "bunny" ||
      Boolean(
        env.BUNNY_STREAM_LIBRARY_ID && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_TOKEN_KEY,
      ),
    {
      message:
        "BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY and BUNNY_STREAM_TOKEN_KEY are required for VIDEO_DRIVER=bunny",
      path: ["VIDEO_DRIVER"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  // Treat empty values (KEY= in .env) as unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  cached ??= serverEnvSchema.parse(raw);
  return cached;
}
