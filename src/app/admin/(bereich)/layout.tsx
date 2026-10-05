import Link from "next/link";

import { SignOutButton } from "@/components/account/sign-out-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminNavFor } from "@/server/auth/admin-routes";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const nav = adminNavFor(user.role).map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Seelenzeit · Admin
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Zur Website
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b bg-background p-3 lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
          <AdminNav items={nav} />
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
