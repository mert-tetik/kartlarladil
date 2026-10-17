import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshAutomationRunStatus, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "social-studio-automation";
const requestSchema = z.object({
  outputId: z.string().uuid(),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

function outputMediaPaths(output: Pick<AutomationOutputRecord, "media_path" | "media_paths">) {
  const paths = [
    typeof output.media_path === "string" && output.media_path.startsWith("automation/") ? output.media_path : null,
    ...(Array.isArray(output.media_paths) ? output.media_paths : []),
  ];
  return [...new Set(paths.filter((path): path is string => typeof path === "string" && path.startsWith("automation/")))];
}

export async function DELETE(request: NextRequest) {
  if (!await hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });

  const scope = normalizeAutomationScope(parsed.data.scope);
  const ownerKey = automationOwnerKey(scope);

  try {
    const supabase = createSupabaseAdminClient();
    const { data: output, error: outputError } = await supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,status,media_path,media_paths,run:social_content_automation_runs!inner(owner_key)")
      .eq("id", parsed.data.outputId)
      .eq("run.owner_key", ownerKey)
      .maybeSingle<AutomationOutputRecord & { run_id: string; run?: { owner_key: string } | null }>();
    if (outputError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!output) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    if (output.status === "scheduled") return NextResponse.json({ errorCode: "scheduled_output_delete_forbidden" }, { status: 409 });
    if (["processing", "generating_video", "awaiting_browser_image", "awaiting_browser_video"].includes(output.status)) {
      return NextResponse.json({ errorCode: "active_output_delete_forbidden" }, { status: 409 });
    }

    const mediaPaths = outputMediaPaths(output);
    // Remove the database row first. This closes the race with schedule-all:
    // once the conditional delete succeeds, no worker can publish this output.
    // Storage cleanup is best-effort afterwards; an orphaned object is safe
    // and will be collected by the maintenance endpoint.
    const { data: deletedOutput, error: deleteError } = await supabase
      .from("social_content_automation_outputs")
      .delete()
      .eq("id", output.id)
      .eq("status", output.status)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (deleteError) return NextResponse.json({ errorCode: "automation_output_delete_failed" }, { status: 503 });
    if (!deletedOutput) return NextResponse.json({ errorCode: "automation_output_changed" }, { status: 409 });

    let cleanupPending = false;
    if (mediaPaths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(mediaPaths);
      if (storageError) {
        cleanupPending = true;
        console.error("[automation-output] Storage cleanup deferred", {
          outputId: output.id,
          mediaCount: mediaPaths.length,
          error: storageError.message,
        });
      }
    }

    await refreshAutomationRunStatus(output.run_id, { autoSchedule: false }).catch(() => undefined);
    return NextResponse.json({ deleted: true, outputId: output.id, removedMediaCount: cleanupPending ? 0 : mediaPaths.length, cleanupPending });
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_output_delete_failed" }, { status: 502 });
  }
}
