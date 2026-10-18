import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { refreshAutomationRunStatus } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioAutomationSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  runId: z.string().uuid(),
  action: z.enum(["stop-generation", "finish"]),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

export async function POST(request: NextRequest) {
  if (!await hasSocialStudioAutomationSession(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_run_action" }, { status: 400 });

  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));
  const supabase = createSupabaseAdminClient();

  try {
    if (parsed.data.action === "stop-generation") {
      const { data, error } = await supabase.rpc("stop_social_content_automation_generation", {
        p_owner_key: ownerKey,
        p_run_id: parsed.data.runId,
      });
      if (error) return NextResponse.json({ errorCode: "automation_run_stop_failed" }, { status: 503 });
      if (data !== true) return NextResponse.json({ errorCode: "automation_run_not_open" }, { status: 409 });
      await refreshAutomationRunStatus(parsed.data.runId, { autoSchedule: false });
      return NextResponse.json({ ok: true, generationStopped: true });
    }

    const { data, error } = await supabase.rpc("finish_social_content_automation_run", {
      p_owner_key: ownerKey,
      p_run_id: parsed.data.runId,
    });
    if (error) return NextResponse.json({ errorCode: "automation_run_finish_failed" }, { status: 503 });
    const result = Array.isArray(data) ? data[0] as { finished?: boolean; status?: string | null } | undefined : undefined;
    if (!result?.finished || !result.status) return NextResponse.json({ errorCode: "automation_run_still_generating" }, { status: 409 });
    return NextResponse.json({ ok: true, finished: true, status: result.status });
  } catch {
    return NextResponse.json({ errorCode: "automation_run_action_failed" }, { status: 503 });
  }
}
