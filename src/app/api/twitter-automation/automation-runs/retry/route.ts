import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshAutomationRunStatus } from "@/features/twitter-automation/automation-run-service";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  outputId: z.string().uuid(),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

type FailedOutput = {
  id: string;
  run_id: string;
  status: string;
  caption: string | null;
  media_path: string | null;
  media_paths: unknown;
  media_type: "image" | "video" | null;
};

function hasReusableMedia(output: FailedOutput) {
  return Boolean(output.caption && output.media_type && (output.media_path || (Array.isArray(output.media_paths) && output.media_paths.length)));
}

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });

  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));

  try {
    const supabase = createSupabaseAdminClient();
    const { data: output, error: outputError } = await supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,status,caption,media_path,media_paths,media_type")
      .eq("id", parsed.data.outputId)
      .maybeSingle<FailedOutput>();
    if (outputError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!output) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", output.run_id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });
    if (output.status !== "failed") return NextResponse.json({ errorCode: "automation_output_retry_not_available" }, { status: 409 });

    const status = hasReusableMedia(output) ? "ready_to_schedule" : "queued";
    const retryPatch = status === "ready_to_schedule"
      ? { status, error_code: null, updated_at: new Date().toISOString() }
      : {
        status,
        caption: null,
        media_path: null,
        media_paths: [],
        media_type: null,
        provider_task_id: null,
        error_code: null,
        generated_at: null,
        updated_at: new Date().toISOString(),
      };
    const { error: retryError } = await supabase
      .from("social_content_automation_outputs")
      .update(retryPatch)
      .eq("id", output.id)
      .eq("status", "failed");
    if (retryError) return NextResponse.json({ errorCode: "automation_output_retry_failed" }, { status: 503 });

    await refreshAutomationRunStatus(run.id);
    return NextResponse.json({ outputId: output.id, status });
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_output_retry_failed" }, { status: 502 });
  }
}
