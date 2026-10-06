import Link from "next/link";

import { SignOutButton } from "@/components/account/sign-out-button";
import { SiteFooter } from "@/components/site/site-footer";
import { hasPermission } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

const NAV = [
  { href: "/konto", label: "Meine Kurse" },
  { href: "/konto/profil", label: "Profil" },
  { href: "/konto/sicherheit", label: "Sicherheit" },
  { href: "/konto/daten", label: "Meine Daten" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isStaff = hasPermission(user.role, "admin:access");

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Seelenzeit
          </Link>
          <div className="flex items-center gap-4">
            {isStaff ? (
              <Link href="/admin" className="text-sm underline-offset-4 hover:underline">
                Adminbereich
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Kontonavigation" className="mx-auto max-w-5xl px-4">
          <ul className="flex gap-5 overflow-x-auto pb-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block py-1 whitespace-nowrap hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}
