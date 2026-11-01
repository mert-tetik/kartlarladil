import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioBlobSignedUrl } from "@/features/twitter-automation/social-studio-blob";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const deliverySchema = z.object({
  action: z.literal("create-delivery-url"),
  path: z.string().regex(/^automation\/(?:manual\/)?[\da-f-]+(?:-\d+)?\.(?:mp4|webm|png)$/iu),
}).strict();
export async function POST(request: NextRequest) {
  if (!await hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as unknown;

  try {
    const delivery = deliverySchema.safeParse(body);
    if (delivery.success) {
      await authorizeBlobUploadPath(delivery.data.path);
      const sourceUrl = await createSocialStudioBlobSignedUrl(delivery.data.path, 24 * 60 * 60);
      return NextResponse.json({ sourceUrl });
    }

    const result = await handleUpload({
      request,
      body: body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname) => {
        await authorizeBlobUploadPath(pathname);
        const isImage = pathname.endsWith(".png");
        return {
          allowedContentTypes: isImage ? ["image/png"] : ["video/mp4", "video/webm"],
          maximumSizeInBytes: isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31_536_000,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "media_stage_unavailable";
    const status = message === "unauthorized" || message === "automation_output_not_found" ? 403 : 400;
    return NextResponse.json({ errorCode: message }, { status });
  }
}

async function authorizeBlobUploadPath(pathname: string) {
  if (/^automation\/manual\/[\da-f-]{36}\.(?:mp4|webm)$/iu.test(pathname)) return;

  const match = /^automation\/([\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})(?:-(\d+))?\.(png|mp4|webm)$/iu.exec(pathname);
  if (!match) throw new Error("invalid_media_stage_path");
  const outputId = match[1];
  const extensionName = match[3]?.toLowerCase();
  const expectedStatus = extensionName === "png" ? "awaiting_browser_image" : "awaiting_browser_video";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_outputs")
    .select("id,status,run:social_content_automation_runs!inner(owner_key)")
    .eq("id", outputId)
    .maybeSingle<{ id: string; status: string; run?: { owner_key: string } | null }>();
  if (error) throw new Error("automation_runs_unavailable");
  if (!data || data.status !== expectedStatus || data.run?.owner_key !== "social-studio" && data.run?.owner_key !== "social-studio-test") {
    throw new Error("automation_output_not_found");
  }
}
