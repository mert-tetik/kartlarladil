import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "social-studio-automation";
const MEDIA_PREFIX = "automation/";
const videoMimeTypeSchema = z.enum(["video/mp4", "video/webm"]);
const imageMimeTypeSchema = z.literal("image/png");
const mediaMimeTypeSchema = z.union([videoMimeTypeSchema, imageMimeTypeSchema]);
const uploadSchema = z.object({
  action: z.literal("create-upload"),
  purpose: z.enum(["manual-video", "automation-video", "automation-image"]),
  mimeType: mediaMimeTypeSchema,
  outputId: z.string().uuid().optional(),
  position: z.number().int().min(0).max(6).optional(),
}).strict().superRefine((value, context) => {
  if ((value.purpose === "automation-video" || value.purpose === "automation-image") && !value.outputId) {
    context.addIssue({ code: "custom", path: ["outputId"], message: "Automation output id is required." });
  }
  if (value.purpose === "automation-image" && value.mimeType !== "image/png") context.addIssue({ code: "custom", path: ["mimeType"], message: "Automation images must be PNG files." });
  if (value.purpose !== "automation-image" && value.mimeType === "image/png") context.addIssue({ code: "custom", path: ["mimeType"], message: "Only automation images can be PNG files." });
  if (value.purpose !== "automation-image" && value.position !== undefined) context.addIssue({ code: "custom", path: ["position"], message: "Only automation images can have a position." });
});
const deliverySchema = z.object({
  action: z.literal("create-delivery-url"),
  path: z.string().regex(/^automation\/(?:manual\/)?[\da-f-]+(?:-\d+)?\.(?:mp4|webm|png)$/iu),
}).strict();
const requestSchema = z.union([uploadSchema, deliverySchema]);

function extension(mimeType: z.infer<typeof mediaMimeTypeSchema>) {
  return mimeType === "image/png" ? "png" : mimeType === "video/webm" ? "webm" : "mp4";
}

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_media_stage_request" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    if (parsed.data.action === "create-delivery-url") {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(parsed.data.path, 24 * 60 * 60);
      if (error || !data?.signedUrl) return NextResponse.json({ errorCode: "media_stage_unavailable" }, { status: 503 });
      return NextResponse.json({ sourceUrl: data.signedUrl });
    }

    const path = parsed.data.purpose === "automation-video"
      ? `${MEDIA_PREFIX}${parsed.data.outputId}.${extension(parsed.data.mimeType)}`
      : parsed.data.purpose === "automation-image"
        ? `${MEDIA_PREFIX}${parsed.data.outputId}${parsed.data.position ? `-${parsed.data.position + 1}` : ""}.${extension(parsed.data.mimeType)}`
        : `${MEDIA_PREFIX}manual/${crypto.randomUUID()}.${extension(parsed.data.mimeType)}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return NextResponse.json({ errorCode: "media_stage_unavailable" }, { status: 503 });
    return NextResponse.json({ path, token: data.token });
  } catch {
    return NextResponse.json({ errorCode: "media_stage_unavailable" }, { status: 503 });
  }
}
