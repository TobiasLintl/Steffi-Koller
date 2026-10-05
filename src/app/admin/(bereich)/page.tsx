import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNavFor } from "@/server/auth/admin-routes";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Übersicht" };

export default async function AdminHomePage() {
  const user = await requirePermission("admin:access");
  const items = adminNavFor(user.role).filter((i) => i.href !== "/admin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hallo {user.name}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{item.label}</CardTitle>
                <CardDescription>Öffnen</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
