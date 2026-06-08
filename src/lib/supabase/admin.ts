import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig, getSupabaseServiceRoleKey } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const config = getSupabaseBrowserConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin account operations.");
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
