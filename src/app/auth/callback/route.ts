import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { ensureUserProfile } from "@/features/auth/auth-session";
import {
  getNativeGoogleAuthHandoffUrl,
  isPkceCodeVerifierError,
} from "@/features/auth/google-oauth-redirects";
import { recordAppLogin } from "@/features/auth/login-events";
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
  const isNativeGoogleAuth = requestUrl.searchParams.get("native") === "1";
  const hasAttemptedNativeHandoff = requestUrl.searchParams.get("nativeHandoff") === "1";
  const t = createTranslator(await getServerLocale());

  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(t("auth.message.notConfigured"))}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(t("auth.message.callbackMissingCode"))}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (isNativeGoogleAuth && code && isPkceCodeVerifierError(error)) {
      if (!hasAttemptedNativeHandoff) {
        return NextResponse.redirect(getNativeGoogleAuthHandoffUrl(code, nextPath));
      }

      return NextResponse.redirect(
        `${origin}/login?message=${encodeURIComponent(error.message)}`,
      );
    }

    const fallbackPath = isPkceCodeVerifierError(error) ? "/reset-password" : "/login";
    return NextResponse.redirect(`${origin}${fallbackPath}?message=${encodeURIComponent(error.message)}`);
  }

  if (user) {
    await recordAppLogin(user.id);
    const { onboardingCompleted } = await ensureUserProfile(supabase, user);

    if (!onboardingCompleted) {
      return NextResponse.redirect(`${origin}/register/preferences?next=${encodeURIComponent(nextPath)}`);
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
