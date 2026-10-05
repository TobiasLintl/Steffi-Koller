"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const active = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href;

  return (
    <nav aria-label="Adminnavigation">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm whitespace-nowrap",
                active === item.href ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
