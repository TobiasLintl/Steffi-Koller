import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { ProfileForm } from "@/components/account/profile-form";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { customerProfiles } from "@/server/db/schema";
import { saveProfile } from "./actions";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser("/konto/profil");
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id));

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
    </div>
  );
}
