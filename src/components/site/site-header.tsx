import Link from "next/link";

const NAV = [
  { href: "/angebote", label: "Angebote" },
  { href: "/ueber-mich", label: "Über mich" },
  { href: "/faq", label: "FAQ" },
  { href: "/kontakt", label: "Kontakt" },
];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Seelenzeit
        </Link>
        <nav aria-label="Hauptnavigation" className="order-3 w-full sm:order-2 sm:w-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="py-1 hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/konto"
          prefetch={false}
          className="order-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent sm:order-3"
        >
          Mein Bereich
        </Link>
      </div>
    </header>
  );
}
