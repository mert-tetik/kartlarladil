import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSocialStudioSession,
  hasSocialStudioSession,
  isSocialStudioAdminCredentials,
  SOCIAL_STUDIO_SESSION_COOKIE,
  SOCIAL_STUDIO_SESSION_MAX_AGE,
} from "@/features/twitter-automation/social-studio-auth";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: hasSocialStudioSession(request.headers.get("cookie")) });
}

export async function POST(request: NextRequest) {
  const payload = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success || !isSocialStudioAdminCredentials(payload.data.username, payload.data.password)) {
    return NextResponse.json({ errorCode: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: SOCIAL_STUDIO_SESSION_COOKIE,
    value: createSocialStudioSession(),
    httpOnly: true,
    maxAge: SOCIAL_STUDIO_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
