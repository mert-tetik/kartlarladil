import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  const config = getSupabaseBrowserConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    },
  });

  // Refresh the session if it has expired. getUser() triggers the cookie
  // refresh logic in @supabase/ssr and writes updated cookies to the response.
  await supabase.auth.getUser();

  return response;
}
