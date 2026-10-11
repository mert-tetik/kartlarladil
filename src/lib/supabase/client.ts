import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

const browserCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

export function createSupabaseBrowserClient(options?: {
  detectSessionInUrl?: boolean;
  isSingleton?: boolean;
}) {
  const config = getSupabaseBrowserConfig();

  return createBrowserClient(config.url, config.publishableKey, {
    ...(options?.isSingleton !== undefined ? { isSingleton: options.isSingleton } : {}),
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? true,
    },
    cookieOptions: browserCookieOptions,
  });
}

/**
 * Recovery emails use Supabase's implicit URL-fragment flow. @supabase/ssr's
 * browser client intentionally forces PKCE, so recovery uses a separate
 * supabase-js client and tab-scoped storage instead of the normal SSR client.
 */
export function createSupabaseRecoveryBrowserClient() {
  const config = getSupabaseBrowserConfig();

  return createClient(config.url, config.publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: true,
      autoRefreshToken: true,
      // The recovery route extracts the hash and calls setSession explicitly.
      // This prevents a second Supabase client from consuming the fragment
      // before the recovery flow can handle it.
      detectSessionInUrl: false,
      storage: typeof window === "undefined" ? undefined : window.sessionStorage,
      storageKey: "foxiesdeck:password-recovery",
    },
  });
}
