import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseBrowserConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { getSupabaseForwardedRequestHeaders } from "@/lib/supabase/native-launch-request";

export async function updateSupabaseSession(request: NextRequest) {
  const createForwardedResponse = () => NextResponse.next({
    request: { headers: getSupabaseForwardedRequestHeaders(request) },
  });
  let response = createForwardedResponse();

  if (!hasSupabaseBrowserConfig()) {
    return response;
  }

  const config = getSupabaseBrowserConfig();
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

  await supabase.auth.getClaims();

  return response;
}
