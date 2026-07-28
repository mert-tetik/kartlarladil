import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  createPkceChallenge,
  createXOAuthState,
  xOAuthStateCookieOptions,
  X_OAUTH_STATE_COOKIE,
} from "@/features/twitter-automation/social-oauth-state";
import {
  createXAuthorizationUrl,
  getXOAuthConfig,
  getXSocialMediaAccount,
} from "@/features/twitter-automation/x-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  socialMediaId: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({ socialMediaId: request.nextUrl.searchParams.get("socialMediaId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_social_media_id" }, { status: 400 });
  }

  try {
    const config = getXOAuthConfig();
    const account = await getXSocialMediaAccount(parsed.data.socialMediaId);
    if (!account) return NextResponse.json({ error: "x_account_not_found" }, { status: 404 });

    const oauthState = createXOAuthState(account.id);
    const authorizeUrl = createXAuthorizationUrl({
      clientId: config.clientId,
      callbackUrl: config.callbackUrl,
      state: oauthState.data.state,
      codeChallenge: createPkceChallenge(oauthState.data.codeVerifier),
    });
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(X_OAUTH_STATE_COOKIE, oauthState.cookieValue, xOAuthStateCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "X OAuth could not be started.";
    return NextResponse.json({ error: "x_oauth_not_configured", message }, { status: 503 });
  }
}
