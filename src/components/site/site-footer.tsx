import Link from "next/link";

import { CookieSettingsLink } from "@/components/consent/cookie-settings-link";

const LEGAL = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerrufsbelehrung" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
        <p>© {new Date().getFullYear()} Seelenzeit</p>
        <nav aria-label="Rechtliches">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/newsletter" className="hover:text-foreground">
                Newsletter
              </Link>
            </li>
            <li>
              <CookieSettingsLink />
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
