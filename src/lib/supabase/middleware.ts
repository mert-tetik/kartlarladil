import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { getSupabaseForwardedRequestHeaders } from "@/lib/supabase/native-launch-request";

export async function updateSession(request: NextRequest) {
  const config = getSupabaseBrowserConfig();
  const createForwardedResponse = () => NextResponse.next({
    request: { headers: getSupabaseForwardedRequestHeaders(request) },
  });
  let response = createForwardedResponse();

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = createForwardedResponse();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });

  // Verify and refresh the session using the locally verifiable claims path
  // where supported, avoiding an unnecessary network round trip per request.
  await supabase.auth.getClaims();

  return response;
}
