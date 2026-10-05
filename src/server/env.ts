import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once at startup.
 * Extend this schema per milestone; never read process.env directly in domain code.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const env: ServerEnv = serverEnvSchema.parse(process.env);
