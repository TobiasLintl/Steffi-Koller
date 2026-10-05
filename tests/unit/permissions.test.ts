import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES, adminNavFor, canAccessAdminPath } from "@/server/auth/admin-routes";
import { hasPermission, ROLES, type Role } from "@/server/auth/permissions";

const allowed = (role: Role) =>
  ADMIN_ROUTES.filter((r) => canAccessAdminPath(role, r.href)).map((r) => r.href);

describe("roles and admin routes (AK-12)", () => {
  it("customers cannot enter the admin area at all", () => {
    expect(allowed("customer")).toEqual([]);
    expect(canAccessAdminPath("customer", "/admin")).toBe(false);
    expect(canAccessAdminPath(null, "/admin/kunden")).toBe(false);
  });

  it("admin can reach every admin route", () => {
    expect(allowed("admin")).toEqual(ADMIN_ROUTES.map((r) => r.href));
  });

  it("support sees customers and access, but no orders, courses or questionnaire data", () => {
    expect(canAccessAdminPath("support", "/admin/kunden/123")).toBe(true);
    expect(canAccessAdminPath("support", "/admin/kaeufe")).toBe(false);
    expect(canAccessAdminPath("support", "/admin/kurse")).toBe(false);
    expect(canAccessAdminPath("support", "/admin/export")).toBe(false);
    expect(hasPermission("support", "questionnaires:read")).toBe(false);
  });

  it("editor manages courses, media and content, but no customers or payments", () => {
    expect(canAccessAdminPath("editor", "/admin/kurse/abc")).toBe(true);
    expect(canAccessAdminPath("editor", "/admin/medien")).toBe(true);
    expect(canAccessAdminPath("editor", "/admin/kunden")).toBe(false);
    expect(canAccessAdminPath("editor", "/admin/kaeufe")).toBe(false);
    expect(canAccessAdminPath("editor", "/admin/produkte")).toBe(false);
  });

  it("accounting sees purchases and exports them, but no course or customer files", () => {
    expect(canAccessAdminPath("accounting", "/admin/kaeufe")).toBe(true);
    expect(canAccessAdminPath("accounting", "/admin/export")).toBe(true);
    expect(canAccessAdminPath("accounting", "/admin/kurse")).toBe(false);
    expect(canAccessAdminPath("accounting", "/admin/kunden")).toBe(false);
    expect(hasPermission("accounting", "exports:all")).toBe(false);
  });

  it("report approver only gets the overview", () => {
    expect(allowed("report_approver")).toEqual(["/admin"]);
    expect(hasPermission("report_approver", "reports:approve")).toBe(true);
    expect(hasPermission("report_approver", "customers:read")).toBe(false);
  });

  it("navigation never shows routes the role cannot open", () => {
    for (const role of ROLES) {
      for (const item of adminNavFor(role)) expect(canAccessAdminPath(role, item.href)).toBe(true);
    }
  });

  it("unknown admin paths are denied by default", () => {
    expect(canAccessAdminPath("support", "/adminfoo")).toBe(false);
  });
});
