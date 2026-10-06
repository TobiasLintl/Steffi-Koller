import { hasPermission, type Permission, type Role } from "./permissions";

/**
 * Admin routes and the permission each one needs. Used for navigation and route guards,
 * so UI and server-side checks cannot drift apart.
 */
export interface AdminRoute {
  href: string;
  label: string;
  permission: Permission;
}

export const ADMIN_ROUTES: readonly AdminRoute[] = [
  { href: "/admin", label: "Übersicht", permission: "admin:access" },
  { href: "/admin/kennzahlen", label: "Kennzahlen", permission: "dashboard:view" },
  { href: "/admin/kunden", label: "Kunden", permission: "customers:read" },
  { href: "/admin/kaeufe", label: "Käufe", permission: "orders:read" },
  { href: "/admin/produkte", label: "Produkte", permission: "products:write" },
  { href: "/admin/kurse", label: "Kurse", permission: "courses:read" },
  { href: "/admin/medien", label: "Medien", permission: "media:write" },
  { href: "/admin/gutscheine", label: "Gutscheine", permission: "coupons:write" },
  { href: "/admin/inhalte", label: "Seiten & FAQ", permission: "content:write" },
  { href: "/admin/nachrichten", label: "Nachrichten", permission: "support:write" },
  { href: "/admin/newsletter", label: "Newsletter", permission: "newsletter:read" },
  { href: "/admin/mitarbeiter", label: "Mitarbeiter", permission: "staff:manage" },
  { href: "/admin/auditlog", label: "Auditlog", permission: "audit:read" },
  { href: "/admin/export", label: "Export", permission: "exports:orders" },
  { href: "/admin/backups", label: "Backups", permission: "backups:manage" },
  { href: "/admin/webhooks", label: "Webhooks", permission: "webhooks:read" },
  { href: "/admin/einstellungen", label: "Einstellungen", permission: "settings:write" },
];

/** Most specific admin route matching a pathname. */
export function adminRouteFor(pathname: string): AdminRoute | undefined {
  return [...ADMIN_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
}

export function canAccessAdminPath(role: Role | null | undefined, pathname: string): boolean {
  if (!hasPermission(role, "admin:access")) return false;
  const route = adminRouteFor(pathname);
  return route ? hasPermission(role, route.permission) : false;
}

export function adminNavFor(role: Role): AdminRoute[] {
  return ADMIN_ROUTES.filter((r) => hasPermission(role, r.permission));
}
