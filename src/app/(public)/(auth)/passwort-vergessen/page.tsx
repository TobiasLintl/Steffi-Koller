import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Passwort vergessen", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Passwort vergessen?"
      description="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
