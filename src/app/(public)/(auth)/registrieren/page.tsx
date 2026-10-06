import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return (
    <AuthCard title="Konto anlegen" description="Dein Ort für deine Kurse – in deinem Tempo.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
