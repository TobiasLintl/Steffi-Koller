import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import { db } from "@/server/db";
import {
  accounts,
  customerProfiles,
  sessions,
  twoFactors,
  users,
  verifications,
} from "@/server/db/schema";
import { serverEnv } from "@/server/env";
import { sendMail } from "@/server/mail/send";
import { emailVerificationMail, magicLinkMail, passwordResetMail } from "@/server/mail/templates";
import { isRole, isStaffRole } from "./permissions";

function createAuth() {
  const env = serverEnv();
  return betterAuth({
    appName: "Seelenzeit",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        twoFactor: twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Prevents account squatting: purchases are matched by e-mail (CLAUDE.md §5.3).
      requireEmailVerification: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendMail("password_reset", user.email, passwordResetMail({ url, name: user.name }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(
          "email_verification",
          user.email,
          emailVerificationMail({ url, name: user.name }),
        );
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: env.AUTH_RATE_LIMIT === "on", window: 60, max: 30 },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.insert(customerProfiles).values({ userId: user.id }).onConflictDoNothing();
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [user] = await db
              .select({ anonymizedAt: users.anonymizedAt })
              .from(users)
              .where(eq(users.id, session.userId));
            // Deleted/anonymised accounts can never sign in again.
            if (!user || user.anonymizedAt) return false;
          },
          after: async (session) => {
            const [user] = await db
              .select({ role: users.role })
              .from(users)
              .where(eq(users.id, session.userId));
            if (user && isRole(user.role) && isStaffRole(user.role)) {
              await writeAudit(db, {
                action: "admin.login",
                actorUserId: session.userId,
                actorRole: user.role,
                targetType: "user",
                targetId: session.userId,
              });
            }
          },
        },
      },
    },
    plugins: [
      twoFactor({ issuer: "Seelenzeit", backupCodeOptions: { storeBackupCodes: "encrypted" } }),
      magicLink({
        disableSignUp: true,
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) => {
          const [user] = await db
            .select({ name: users.name, role: users.role })
            .from(users)
            .where(eq(users.email, email.toLowerCase()));
          // Staff must sign in with password + TOTP; a magic link would bypass 2FA.
          if (!user || (isRole(user.role) && isStaffRole(user.role))) return;
          await sendMail("magic_link", email, magicLinkMail({ url, name: user.name }));
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
