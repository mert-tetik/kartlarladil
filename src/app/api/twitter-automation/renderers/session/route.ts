import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationRenderer } from "@/features/twitter-automation/automation-renderer-service";
import { AUTOMATION_RENDERER_SESSION_COOKIE, AUTOMATION_RENDERER_SESSION_MAX_AGE, createAutomationRendererSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return NextResponse.json({ errorCode: "automation_renderer_token_missing" }, { status: 401 });
  try {
    const renderer = await authenticateAutomationRenderer(token);
    if (!renderer) return NextResponse.json({ errorCode: "automation_renderer_token_invalid" }, { status: 401 });
    const response = NextResponse.json({ rendererId: renderer.id, ownerKey: renderer.owner_key, expiresIn: AUTOMATION_RENDERER_SESSION_MAX_AGE });
    response.cookies.set(AUTOMATION_RENDERER_SESSION_COOKIE, createAutomationRendererSession(renderer.id, renderer.owner_key), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTOMATION_RENDERER_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_renderer_session_failed" }, { status: 503 });
  }
}
