import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Anmelden", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthCard
      title="Willkommen zurück"
      description="Melde dich an, um zu deinen Kursen zu gelangen."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
