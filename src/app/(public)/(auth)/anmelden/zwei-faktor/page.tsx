import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = { title: "Bestätigung", robots: { index: false } };

export default function TwoFactorPage() {
  return (
    <AuthCard title="Noch ein kurzer Schritt" description="Bitte bestätige deine Anmeldung.">
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
