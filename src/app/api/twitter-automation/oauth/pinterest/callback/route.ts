import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  hasMatchingPinterestOAuthState,
  pinterestOAuthStateCookieOptions,
  PINTEREST_OAUTH_STATE_COOKIE,
  readPinterestOAuthState,
} from "@/features/twitter-automation/pinterest-oauth-state";
import {
  exchangePinterestAuthorizationCode,
  getPinterestCurrentUser,
  getPinterestOAuthConfig,
  getPinterestSocialMediaAccount,
  isExpectedPinterestAccount,
  savePinterestConnection,
} from "@/features/twitter-automation/pinterest-oauth";
import { createSocialAutomationUrl } from "@/features/twitter-automation/x-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resultRedirect(result: string, errorCode?: string) {
  const url = createSocialAutomationUrl("/content-automation/automations");
  url.searchParams.set("pinterestOAuth", result);
  if (errorCode) url.searchParams.set("pinterestOAuthError", errorCode);
  return url;
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(PINTEREST_OAUTH_STATE_COOKIE, "", { ...pinterestOAuthStateCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = readPinterestOAuthState(request.cookies.get(PINTEREST_OAUTH_STATE_COOKIE)?.value);

  if (providerError) return clearStateCookie(NextResponse.redirect(resultRedirect("cancelled", "authorization_cancelled")));
  if (!code || !savedState || !hasMatchingPinterestOAuthState(savedState, state)) {
    return clearStateCookie(NextResponse.redirect(resultRedirect("invalid_state", "state_validation_failed")));
  }

  try {
    const config = getPinterestOAuthConfig();
    const account = await getPinterestSocialMediaAccount(savedState.socialMediaId);
    if (!account) return clearStateCookie(NextResponse.redirect(resultRedirect("account_missing", "account_not_found")));

    const token = await exchangePinterestAuthorizationCode({ code, config });
    const currentUser = await getPinterestCurrentUser(token.access_token!);
    if (!isExpectedPinterestAccount(account["Account Name"], currentUser.username)) {
      return clearStateCookie(NextResponse.redirect(resultRedirect("account_mismatch", "account_mismatch")));
    }

    await savePinterestConnection({ account, currentUser, token });
    return clearStateCookie(NextResponse.redirect(resultRedirect("success")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorCode = message.includes("TOKEN_ENCRYPTION_KEY") ? "token_encryption_not_configured"
      : message.includes("could not be saved") ? "connection_save_failed"
        : message.includes("access token") ? "token_exchange_failed"
          : message.includes("identity") ? "identity_verification_failed"
            : "unexpected_callback_failure";
    return clearStateCookie(NextResponse.redirect(resultRedirect("failed", errorCode)));
  }
}
