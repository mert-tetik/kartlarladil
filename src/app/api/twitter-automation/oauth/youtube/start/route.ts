import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  createYouTubeOAuthState,
  youTubeOAuthStateCookieOptions,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/features/twitter-automation/youtube-oauth-state";
import {
  createYouTubeAuthorizationUrl,
  getYouTubeOAuthConfig,
  getYouTubeSocialMediaAccount,
} from "@/features/twitter-automation/youtube-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ socialMediaId: z.coerce.number().int().positive() });

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({ socialMediaId: request.nextUrl.searchParams.get("socialMediaId") });
  if (!parsed.success) return NextResponse.json({ error: "invalid_social_media_id" }, { status: 400 });

  try {
    const config = getYouTubeOAuthConfig();
    const account = await getYouTubeSocialMediaAccount(parsed.data.socialMediaId);
    if (!account) return NextResponse.json({ error: "youtube_account_not_found" }, { status: 404 });

    const oauthState = createYouTubeOAuthState(account.id);
    const authorizeUrl = createYouTubeAuthorizationUrl({
      clientId: config.clientId,
      callbackUrl: config.callbackUrl,
      state: oauthState.data.state,
    });
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(YOUTUBE_OAUTH_STATE_COOKIE, oauthState.cookieValue, youTubeOAuthStateCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube OAuth could not be started.";
    return NextResponse.json({ error: "youtube_oauth_not_configured", message }, { status: 503 });
  }
}
