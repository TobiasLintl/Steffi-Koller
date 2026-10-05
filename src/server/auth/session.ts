import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "./auth";
import { hasPermission, isRole, isStaffRole, type Permission, type Role } from "./permissions";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = session.user.role;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: isRole(role) ? role : "customer",
    twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
    emailVerified: session.user.emailVerified,
  };
});

/** Any signed-in user (customer area). */
export async function requireUser(returnTo = "/konto"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/anmelden?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Staff member with admin access and completed 2FA enrolment. */
export async function requireStaff(returnTo = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!isStaffRole(user.role) || !hasPermission(user.role, "admin:access")) redirect("/konto");
  if (!user.twoFactorEnabled) redirect("/admin/2fa-einrichten");
  return user;
}

/** Staff member with a specific permission. Use in every admin page and server action. */
export async function requirePermission(
  permission: Permission,
  returnTo = "/admin",
): Promise<CurrentUser> {
  const user = await requireStaff(returnTo);
  if (!hasPermission(user.role, permission)) redirect("/admin/kein-zugriff");
  return user;
}

/** For route handlers: staff user with permission (incl. 2FA) or null – no redirects. */
export async function staffWithPermission(permission: Permission): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (
    !user ||
    !isStaffRole(user.role) ||
    !user.twoFactorEnabled ||
    !hasPermission(user.role, permission)
  )
    return null;
  return user;
}
