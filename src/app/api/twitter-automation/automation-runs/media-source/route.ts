import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { hasSocialStudioAutomationSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "social-studio-automation";
const AUTOMATION_IMAGE_PATH = /^automation\/[\da-f-]+(?:-\d+)?\.(?:png|jpe?g|webp)$/iu;
const requestSchema = z.object({
  outputId: z.string().uuid(),
  scope: z.enum(["production", "test"]).optional(),
});

type VideoSourceOutput = {
  id: string;
  run_id: string;
  generator: string;
  status: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
};

export async function GET(request: NextRequest) {
  if (!hasSocialStudioAutomationSession(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }
  const parsed = requestSchema.safeParse({
    outputId: request.nextUrl.searchParams.get("outputId"),
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: output, error: outputError } = await supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,generator,status,media_path,media_type")
      .eq("id", parsed.data.outputId)
      .maybeSingle<VideoSourceOutput>();
    if (outputError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!output) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));
    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", output.run_id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    if (
      output.status !== "awaiting_browser_video"
      || !output.generator.startsWith("music-")
      || output.media_type !== "image"
      || !output.media_path
      || !AUTOMATION_IMAGE_PATH.test(output.media_path)
    ) {
      return NextResponse.json({ errorCode: "browser_video_source_missing" }, { status: 409 });
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(output.media_path, 60 * 60);
    if (error || !data?.signedUrl) return NextResponse.json({ errorCode: "browser_video_source_url_failed" }, { status: 503 });
    return NextResponse.json({ sourceUrl: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "browser_video_source_url_failed" }, { status: 503 });
  }
}
