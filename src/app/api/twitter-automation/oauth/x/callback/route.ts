import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  hasMatchingXOAuthState,
  readXOAuthState,
  xOAuthStateCookieOptions,
  X_OAUTH_STATE_COOKIE,
} from "@/features/twitter-automation/social-oauth-state";
import {
  createSocialAutomationUrl,
  exchangeXAuthorizationCode,
  getXCurrentUser,
  getXOAuthConfig,
  getXSocialMediaAccount,
  isExpectedXAccount,
  saveXConnection,
} from "@/features/twitter-automation/x-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resultRedirect(result: string) {
  const url = createSocialAutomationUrl("/content-automation/automations");
  url.searchParams.set("xOAuth", result);
  return url;
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(X_OAUTH_STATE_COOKIE, "", { ...xOAuthStateCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = readXOAuthState(request.cookies.get(X_OAUTH_STATE_COOKIE)?.value);

  if (providerError) return clearStateCookie(NextResponse.redirect(resultRedirect("cancelled")));
  if (!code || !savedState || !hasMatchingXOAuthState(savedState, state)) {
    return clearStateCookie(NextResponse.redirect(resultRedirect("invalid_state")));
  }

  try {
    const config = getXOAuthConfig();
    const account = await getXSocialMediaAccount(savedState.socialMediaId);
    if (!account) return clearStateCookie(NextResponse.redirect(resultRedirect("account_missing")));

    const token = await exchangeXAuthorizationCode({ code, codeVerifier: savedState.codeVerifier, config });
    const currentUser = await getXCurrentUser(token.access_token!);
    if (!isExpectedXAccount(account["Account Name"], currentUser.username)) {
      return clearStateCookie(NextResponse.redirect(resultRedirect("account_mismatch")));
    }

    await saveXConnection({ account, currentUser, token });
    return clearStateCookie(NextResponse.redirect(resultRedirect("success")));
  } catch {
    return clearStateCookie(NextResponse.redirect(resultRedirect("failed")));
  }
}
