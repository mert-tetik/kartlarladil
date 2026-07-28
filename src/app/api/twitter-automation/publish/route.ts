import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publishSocialContent } from "@/features/twitter-automation/social-publishing";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  socialMediaId: z.number().int().positive(),
  caption: z.string().trim().min(1).max(280),
  asset: z.object({
    dataUrl: z.string().max(7_000_000),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  }).optional(),
}).strict();

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });

  try {
    const result = await publishSocialContent(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "provider_publish_failed";
    const status = errorCode === "account_not_found" ? 404 : errorCode === "invalid_media" ? 400 : errorCode === "provider_not_configured" ? 409 : 502;
    return NextResponse.json({ errorCode }, { status });
  }
}
