import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessAdminPath } from "@/server/auth/admin-routes";
import { hasPermission, PERMISSIONS, ROLES, type Permission } from "@/server/auth/permissions";

const ADMIN_DIR = "src/app/admin/(bereich)";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** "src/app/admin/(bereich)/kunden/[id]/page.tsx" → "/admin/kunden/x" */
function routeOf(file: string): string {
  const rel = path.relative(ADMIN_DIR, path.dirname(file)).split(path.sep).filter(Boolean);
  return `/admin${rel
    .map((s) => (s.startsWith("[") ? "x" : `/${s}`))
    .join("")
    .replace(/x/g, "/x")}`;
}

const files = walk(ADMIN_DIR);

describe("AK-12: every admin page checks permissions server-side", () => {
  const pages = files.filter((f) => f.endsWith("page.tsx"));

  it.each(pages)("%s", (file) => {
    const source = readFileSync(file, "utf8");
    const match = source.match(/requirePermission\("([a-z:]+)"/);
    expect(match, `${file} must call requirePermission`).not.toBeNull();
    const permission = match![1] as Permission;
    expect(PERMISSIONS).toContain(permission);
    // The page may be stricter than the navigation entry, never more permissive.
    for (const role of ROLES) {
      if (hasPermission(role, permission))
        expect(canAccessAdminPath(role, routeOf(file)), `${role} on ${file}`).toBe(true);
    }
  });
});

describe("AK-12: every admin server action checks permissions", () => {
  const actionFiles = files.filter((f) => f.endsWith("actions.ts"));

  it.each(actionFiles)("%s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source.startsWith('"use server"')).toBe(true);
    const bodies = source.split(/\nexport async function /).slice(1);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      const name = body.slice(0, body.indexOf("("));
      expect(
        /requirePermission\(|await guard\(\)/.test(body.split(/\n}\n/)[0]!),
        `${name} in ${file}`,
      ).toBe(true);
    }
  });

  it("inline server actions in pages are guarded too", () => {
    for (const file of files.filter((f) => f.endsWith("page.tsx"))) {
      const source = readFileSync(file, "utf8");
      for (const block of source.split('"use server";').slice(1)) {
        expect(block.slice(0, 300)).toMatch(/requirePermission\(/);
      }
    }
  });
});
