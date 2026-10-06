/**
 * Central role → permission mapping (CLAUDE.md §5.7). The only place where rights are defined.
 * Every server-side check goes through `hasPermission`.
 */

export const ROLES = [
  "customer",
  "admin",
  "support",
  "editor",
  "accounting",
  "report_approver",
] as const;

export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ROLES.filter((r) => r !== "customer") as Exclude<Role, "customer">[];

export const PERMISSIONS = [
  // Customer area
  "account:self",
  // Admin area
  "admin:access",
  "dashboard:view",
  "customers:read",
  "customers:write",
  "entitlements:read",
  "entitlements:write",
  "orders:read",
  "products:write",
  "courses:read",
  "courses:write",
  "media:write",
  "coupons:write",
  "content:write",
  "newsletter:read",
  "support:write",
  "staff:manage",
  "audit:read",
  "exports:orders",
  "exports:all",
  "backups:manage",
  "settings:write",
  "webhooks:read",
  "questionnaires:read",
  "reports:approve",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: ["account:self"],
  admin: PERMISSIONS,
  // Master data, access and support – no questionnaire contents, no payment data.
  support: [
    "admin:access",
    "customers:read",
    "customers:write",
    "entitlements:read",
    "entitlements:write",
    "newsletter:read",
    "support:write",
  ],
  // Courses, lessons, media and page content – no payment or questionnaire data.
  editor: ["admin:access", "courses:read", "courses:write", "media:write", "content:write"],
  // Purchases, receipt references and their export – no course or questionnaire contents.
  accounting: ["admin:access", "dashboard:view", "orders:read", "exports:orders"],
  // Only questionnaire/report approval.
  report_approver: ["admin:access", "questionnaires:read", "reports:approve"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: Role): boolean {
  return role !== "customer";
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Kundin/Kunde",
  admin: "Admin",
  support: "Kundenservice",
  editor: "Redaktion",
  accounting: "Buchhaltung",
  report_approver: "Berichtsfreigabe",
};
