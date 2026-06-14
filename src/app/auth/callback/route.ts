import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { ensureUserProfile } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"), DEFAULT_AUTH_REDIRECT);
  const t = createTranslator(await getServerLocale());

  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(t("auth.message.notConfigured"))}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(t("auth.message.callbackMissingCode"))}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { onboardingCompleted } = await ensureUserProfile(supabase, user);

    if (!onboardingCompleted) {
      return NextResponse.redirect(`${origin}/register/preferences?next=${encodeURIComponent(nextPath)}`);
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
