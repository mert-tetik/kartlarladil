import { NextRequest, NextResponse } from "next/server";
import { getSocialAnalyticsData } from "@/features/developer/social-analytics-data";
import { hasDeveloperAdminRequest } from "@/features/developer/developer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readDays(request: NextRequest) {
  const parsed = Number(request.nextUrl.searchParams.get("days") ?? "30");
  return Number.isFinite(parsed) ? parsed : 30;
}

export async function GET(request: NextRequest) {
  if (!(await hasDeveloperAdminRequest(request.headers.get("cookie")))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getSocialAnalyticsData(readDays(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ errorCode: "social_analytics_unavailable" }, { status: 503 });
  }
}
