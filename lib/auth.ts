import "server-only";

import { redirect } from "next/navigation";

import { hasDatabaseConfiguration } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const appRoles = [
  "administrator",
  "editor",
  "producer",
  "researcher",
  "reviewer",
  "read_only",
] as const;

export type AppRole = (typeof appRoles)[number];

export interface CurrentProfile {
  id: string;
  displayName: string | null;
  role: AppRole;
  active: boolean;
  email: string | null;
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

export function roleCanEdit(role: AppRole): boolean {
  return ["administrator", "editor", "producer", "researcher"].includes(role);
}

export function roleCanReview(role: AppRole): boolean {
  return ["administrator", "editor", "reviewer"].includes(role);
}

export function roleCanAdminister(role: AppRole): boolean {
  return role === "administrator";
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  if (!hasDatabaseConfiguration()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, active")
    .eq("id", userData.user.id)
    .eq("active", true)
    .single();

  if (profileError || !profile || !isAppRole(profile.role)) {
    return null;
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    active: profile.active,
    email: userData.user.email ?? null,
  };
}

export async function requireCurrentProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const profile = await requireCurrentProfile();

  if (!allowedRoles.includes(profile.role)) {
    redirect("/unauthorized");
  }

  return profile;
}
