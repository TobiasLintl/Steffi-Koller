import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { ProfileForm } from "@/components/account/profile-form";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { NEWSLETTER_CONSENT_TEXT } from "@/server/domain/newsletter/rules";
import { newsletterStatusFor } from "@/server/services/newsletter";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { customerProfiles } from "@/server/db/schema";
import { saveProfile, unsubscribeOwnNewsletter } from "./actions";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser("/konto/profil");
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id));
  const newsletter = await newsletterStatusFor(db, user.email);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profil</h1>
        <p className="text-sm text-muted-foreground">Angemeldet als {user.email}</p>
      </div>
      <ProfileForm
        action={saveProfile}
        values={{
          customerType: profile?.customerType ?? "b2c",
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
          country: profile?.country ?? null,
          companyName: profile?.companyName ?? null,
          vatId: profile?.vatId ?? null,
          street: profile?.street ?? null,
          postalCode: profile?.postalCode ?? null,
          city: profile?.city ?? null,
        }}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Newsletter</CardTitle>
          <CardDescription>
            {newsletter?.status === "confirmed"
              ? `Angemeldet seit ${formatDate(newsletter.confirmedAt)}.`
              : newsletter?.status === "pending"
                ? "Bestätigung ausstehend – bitte schau in dein Postfach."
                : "Du bist nicht angemeldet."}
          </CardDescription>
        </CardHeader>
        {newsletter?.status === "confirmed" ? (
          <form action={unsubscribeOwnNewsletter}>
            <Button type="submit" variant="outline">
              Newsletter abbestellen
            </Button>
          </form>
        ) : (
          <NewsletterForm
            source="account"
            consentText={NEWSLETTER_CONSENT_TEXT}
            defaultEmail={user.email}
          />
        )}
      </Card>
    </div>
  );
}
