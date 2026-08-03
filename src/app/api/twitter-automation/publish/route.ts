import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publishWithUploadPost } from "@/features/twitter-automation/upload-post-publishing";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const imageAssetSchema = z.object({
  dataUrl: z.string().max(7_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
}).strict();

const videoAssetSchema = z.object({
  sourceUrl: z.string().url().max(2_000),
  mimeType: z.enum(["video/mp4", "video/webm"]),
}).strict();

const schema = z.object({
  socialMediaId: z.number().int().positive(),
  caption: z.string().trim().min(1).max(280),
  asset: z.union([imageAssetSchema, videoAssetSchema]).optional(),
  assets: z.array(imageAssetSchema).min(2).max(10).optional(),
}).strict().superRefine((value, context) => {
  if (value.asset && value.assets) {
    context.addIssue({ code: "custom", message: "Use asset or assets, not both.", path: ["assets"] });
  }
});

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });

  try {
    const result = await publishWithUploadPost(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "upload_post_unavailable";
    const status = errorCode === "account_not_found" ? 404
      : errorCode === "invalid_media" || errorCode === "upload_post_unsupported_content" || errorCode === "upload_post_carousel_limit" ? 400
        : errorCode === "upload_post_not_configured" || errorCode === "upload_post_pinterest_board_not_configured" ? 409
          : errorCode === "upload_post_rejected" ? 502 : 503;
    return NextResponse.json({ errorCode }, { status });
  }
}
