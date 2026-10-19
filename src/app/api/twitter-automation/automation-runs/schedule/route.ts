import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { describeAutomationScheduleFailure, logAutomationRequestFailure, scheduleReadyAutomationRun } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { AUTOMATION_SCHEDULE_BATCH_SIZE } from "@/features/twitter-automation/automation-schedule-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const requestSchema = z.object({
  runId: z.string().uuid(),
  outputId: z.string().uuid().optional(),
  outputIds: z.array(z.string().uuid()).min(1).max(AUTOMATION_SCHEDULE_BATCH_SIZE).refine((ids) => new Set(ids).size === ids.length).optional(),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

export async function POST(request: NextRequest) {
  if (!await hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  const scope = normalizeAutomationScope(parsed.data.scope);
  if (scope === "test") return NextResponse.json({ errorCode: "test_automation_schedule_disabled" }, { status: 403 });
  if (Boolean(parsed.data.outputId) === Boolean(parsed.data.outputIds?.length)) {
    return NextResponse.json({ errorCode: "invalid_automation_schedule_batch" }, { status: 400 });
  }
  const ownerKey = automationOwnerKey(scope);

  try {
    const supabase = createSupabaseAdminClient();
    const { data: run, error } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", parsed.data.runId)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (error) {
      logAutomationRequestFailure("automation_schedule_run_read_failed", error, { runId: parsed.data.runId, scope });
      return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    }
    if (!run) {
      logAutomationRequestFailure("automation_schedule_run_not_found", new Error("automation_run_not_found"), { runId: parsed.data.runId, scope });
      return NextResponse.json({ errorCode: "automation_run_not_found" }, { status: 404 });
    }

    const result = parsed.data.outputId
      ? await scheduleReadyAutomationRun(run.id, { outputId: parsed.data.outputId })
      : await scheduleReadyAutomationRun(run.id, { outputIds: parsed.data.outputIds! });
    return NextResponse.json(result);
  } catch (error) {
    logAutomationRequestFailure("automation_schedule_request_failed", error, {
      runId: parsed.data.runId,
      scope,
    });
    return NextResponse.json(describeAutomationScheduleFailure(error), { status: 502 });
  }
}
