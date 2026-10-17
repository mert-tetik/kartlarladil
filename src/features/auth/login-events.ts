import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Login telemetry is deliberately best-effort. Authentication must still
 * succeed when analytics storage is unavailable or the migration has not yet
 * been applied to the connected Supabase project.
 */
export async function recordAppLogin(userId: string) {
  try {
    const { error } = await createSupabaseAdminClient()
      .from("app_login_events")
      .insert({ user_id: userId });

    if (error) {
      console.error("[auth.login-events] Failed to record app login", {
        userId,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("[auth.login-events] Login telemetry unavailable", {
      userId,
      error,
    });
  }
}
