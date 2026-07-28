import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  createPinterestOAuthState,
  pinterestOAuthStateCookieOptions,
  PINTEREST_OAUTH_STATE_COOKIE,
} from "@/features/twitter-automation/pinterest-oauth-state";
import {
  createPinterestAuthorizationUrl,
  getPinterestOAuthConfig,
  getPinterestSocialMediaAccount,
} from "@/features/twitter-automation/pinterest-oauth";

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
  if (!parsed.success) return NextResponse.json({ error: "invalid_social_media_id" }, { status: 400 });

  try {
    const config = getPinterestOAuthConfig();
    const account = await getPinterestSocialMediaAccount(parsed.data.socialMediaId);
    if (!account) return NextResponse.json({ error: "pinterest_account_not_found" }, { status: 404 });

    const oauthState = createPinterestOAuthState(account.id);
    const authorizeUrl = createPinterestAuthorizationUrl({
      clientId: config.clientId,
      callbackUrl: config.callbackUrl,
      state: oauthState.data.state,
    });
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(PINTEREST_OAUTH_STATE_COOKIE, oauthState.cookieValue, pinterestOAuthStateCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pinterest OAuth could not be started.";
    return NextResponse.json({ error: "pinterest_oauth_not_configured", message }, { status: 503 });
  }
}
