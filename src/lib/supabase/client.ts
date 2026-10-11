import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

const browserCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

export function createSupabaseBrowserClient(options?: { detectSessionInUrl?: boolean }) {
  const config = getSupabaseBrowserConfig();

  return createBrowserClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? true,
    },
    cookieOptions: browserCookieOptions,
  });
}

/**
 * Recovery emails use Supabase's implicit URL-fragment flow. Keep this
 * client separate from the normal PKCE client, while sharing its cookie
 * storage so the server can authenticate the following update-password page.
 */
export function createSupabaseRecoveryBrowserClient() {
  const config = getSupabaseBrowserConfig();

  return createBrowserClient(config.url, config.publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: true,
      autoRefreshToken: true,
      // The recovery route extracts the hash and calls setSession explicitly.
      // This prevents a second Supabase client from consuming the fragment
      // before the recovery flow can handle it.
      detectSessionInUrl: false,
    },
    cookieOptions: browserCookieOptions,
  });
}
