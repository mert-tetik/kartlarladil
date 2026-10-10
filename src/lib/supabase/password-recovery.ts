import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";

/**
 * Password recovery links can be opened from another browser or device.
 * Keep this request client implicit so the email link carries a recovery
 * session in the URL instead of requiring a PKCE verifier cookie.
 */
export function createSupabasePasswordRecoveryClient() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const config = getSupabaseBrowserConfig();

  return createClient(config.url, config.publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
