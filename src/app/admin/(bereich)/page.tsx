import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { adminNavFor } from "@/server/auth/admin-routes";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listAdminNotifications } from "@/server/services/notifications";

export const metadata = { title: "Übersicht" };

export default async function AdminHomePage() {
  const user = await requirePermission("admin:access");
  const items = adminNavFor(user.role).filter((i) => i.href !== "/admin");
  // Notifications concern purchases/refunds/webhooks: only for roles that may see orders.
  const notifications = hasPermission(user.role, "orders:read")
    ? await listAdminNotifications(db, 10)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hallo {user.name}</h1>

      {notifications.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Benachrichtigungen</CardTitle>
          </CardHeader>
          <ul className="flex flex-col divide-y text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="py-2">
                <p className="font-medium">
                  {n.link ? (
                    <Link href={n.link} className="underline-offset-4 hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                <p className="text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
