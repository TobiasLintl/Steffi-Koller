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
    ADMIN_NOTIFICATION_EMAIL: z.email().optional(),

    COPECART_WEBHOOK_SECRET: z.string().optional(),
    DIGISTORE24_IPN_PASSPHRASE: z.string().optional(),
  })
  .refine((env) => env.NODE_ENV !== "production" || Boolean(env.BETTER_AUTH_SECRET), {
    message: "BETTER_AUTH_SECRET is required in production",
    path: ["BETTER_AUTH_SECRET"],
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
