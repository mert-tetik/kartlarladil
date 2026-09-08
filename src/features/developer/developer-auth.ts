import "server-only";

import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/features/auth/auth-redirects";
import { getSupabaseBrowserConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DeveloperAdminIdentity {
  id: string;
  email: string;
}

function configuredAdminEmails() {
  return new Set(
    (process.env.DEVELOPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isDeveloperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

function toIdentity(user: { id: string; email?: string | null } | null): DeveloperAdminIdentity | null {
  if (!user?.email || !isDeveloperAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

export async function getCurrentDeveloperAdmin(): Promise<DeveloperAdminIdentity | null> {
  if (!hasSupabaseBrowserConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return toIdentity(user);
}

export async function requireDeveloperAdmin(nextPath: string): Promise<DeveloperAdminIdentity> {
  if (!hasSupabaseBrowserConfig()) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const safePath = getSafeNextPath(nextPath, "/developer");

  if (error || !user) redirect(`/login?next=${encodeURIComponent(safePath)}`);

  const identity = toIdentity(user);
  if (!identity) redirect("/");
  return identity;
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").flatMap((chunk) => {
    const [name, ...rest] = chunk.trim().split("=");
    const value = rest.join("=");
    return name && value ? [{ name, value }] : [];
  });
}

/** Verifies the Supabase identity remotely for protected route handlers. */
export async function hasDeveloperAdminRequest(cookieHeader: string | null) {
  if (!hasSupabaseBrowserConfig()) return false;

  const config = getSupabaseBrowserConfig();
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: { getAll: () => parseCookieHeader(cookieHeader), setAll: () => undefined },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && Boolean(toIdentity(user));
}
