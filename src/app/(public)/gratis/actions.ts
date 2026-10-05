"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { claimFreeProduct } from "@/server/services/catalog";

export async function claimFreeProductAction(productId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/registrieren?next=${encodeURIComponent("/gratis")}`);
  const result = await claimFreeProduct(db, user.id, z.uuid().parse(productId));
  if (result.status === "not_found") redirect("/gratis");
  redirect(`/konto/kurse/${result.courseSlug}`);
}
