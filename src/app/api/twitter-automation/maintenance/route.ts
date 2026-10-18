import { NextRequest, NextResponse } from "next/server";
import { cleanupAllAutomationRunData } from "@/features/twitter-automation/automation-maintenance-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "forbidden" }, { status: 403 });

  try {
    const result = await cleanupAllAutomationRunData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[automation-maintenance] Daily run and media cleanup failed", error);
    return NextResponse.json({ errorCode: "automation_run_cleanup_failed" }, { status: 503 });
  }
}
