import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasDeveloperAdminRequest } from "@/features/developer/developer-auth";
import { getSocialAnalyticsPosts } from "@/features/developer/social-analytics-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  accountId: z.coerce.number().int().positive(),
  cursor: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

function errorStatus(errorCode: string) {
  if (errorCode === "social_media_not_found") return 404;
  if (errorCode === "upload_post_not_configured" || errorCode === "upload_post_profile_not_configured" || errorCode === "upload_post_analytics_unsupported") return 409;
  return 502;
}

export async function GET(request: NextRequest) {
  if (!(await hasDeveloperAdminRequest(request.headers.get("cookie")))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    accountId: request.nextUrl.searchParams.get("accountId"),
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_social_analytics_posts_request" }, { status: 400 });

  try {
    return NextResponse.json(await getSocialAnalyticsPosts(parsed.data.accountId, parsed.data.cursor, parsed.data.limit), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "social_analytics_posts_unavailable";
    console.error("[social-analytics/posts] Failed to load account posts", {
      accountId: parsed.data.accountId,
      cursor: parsed.data.cursor ?? null,
      error,
    });
    return NextResponse.json({ errorCode }, { status: errorStatus(errorCode) });
  }
}
