import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: await hasSocialStudioSession(request.headers.get("cookie")) });
}
