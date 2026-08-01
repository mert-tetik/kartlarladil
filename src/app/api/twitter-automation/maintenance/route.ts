import { NextRequest, NextResponse } from "next/server";
import { cleanupStagedAutomationMedia } from "@/features/twitter-automation/automation-run-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "forbidden" }, { status: 403 });

  try {
    const result = await cleanupStagedAutomationMedia();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ errorCode: "automation_media_cleanup_failed" }, { status: 503 });
  }
}
