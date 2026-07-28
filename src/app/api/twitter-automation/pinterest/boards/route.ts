import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPinterestBoards } from "@/features/twitter-automation/social-publishing";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  socialMediaId: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({ socialMediaId: request.nextUrl.searchParams.get("socialMediaId") });
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_social_media_id" }, { status: 400 });

  try {
    const boards = await listPinterestBoards(parsed.data.socialMediaId);
    return NextResponse.json({ boards });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "pinterest_boards_unavailable";
    const status = errorCode === "provider_not_configured" ? 409 : errorCode === "token_expired" ? 401 : 502;
    return NextResponse.json({ errorCode, boards: [] }, { status });
  }
}
