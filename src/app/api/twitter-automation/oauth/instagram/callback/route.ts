import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  hasMatchingInstagramOAuthState,
  instagramOAuthStateCookieOptions,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  readInstagramOAuthState,
} from "@/features/twitter-automation/instagram-oauth-state";
import {
  exchangeInstagramAuthorizationCode,
  exchangeInstagramLongLivedToken,
  getInstagramCurrentUser,
  getInstagramOAuthConfig,
  getInstagramSocialMediaAccount,
  isExpectedInstagramAccount,
  saveInstagramConnection,
} from "@/features/twitter-automation/instagram-oauth";
import { createSocialAutomationUrl } from "@/features/twitter-automation/x-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resultRedirect(result: string, errorCode?: string) {
  const url = createSocialAutomationUrl("/content-automation/automations");
  url.searchParams.set("instagramOAuth", result);
  if (errorCode) url.searchParams.set("instagramOAuthError", errorCode);
  return url;
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, "", { ...instagramOAuthStateCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = readInstagramOAuthState(request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value);

  if (providerError) return clearStateCookie(NextResponse.redirect(resultRedirect("cancelled", "authorization_cancelled")));
  if (!code || !savedState || !hasMatchingInstagramOAuthState(savedState, state)) {
    return clearStateCookie(NextResponse.redirect(resultRedirect("invalid_state", "state_validation_failed")));
  }

  try {
    const config = getInstagramOAuthConfig();
    const account = await getInstagramSocialMediaAccount(savedState.socialMediaId);
    if (!account) return clearStateCookie(NextResponse.redirect(resultRedirect("account_missing", "account_not_found")));

    const shortLivedToken = await exchangeInstagramAuthorizationCode({ code, config });
    const token = await exchangeInstagramLongLivedToken(shortLivedToken.access_token!, config);
    const currentUser = await getInstagramCurrentUser(token.access_token!);
    if (!isExpectedInstagramAccount(account["Account Name"], currentUser.username)) {
      return clearStateCookie(NextResponse.redirect(resultRedirect("account_mismatch", "account_mismatch")));
    }

    await saveInstagramConnection({ account, currentUser, token });
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
