import { createHash } from "node:crypto";
import { z } from "zod";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERFORMANCE_DIAGNOSTICS_POLICY_VERSION } from "@/lib/performance-diagnostics-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeDeviceText = z.string().trim().max(80).regex(/^[\p{L}\p{N} ._()+/-]*$/u);
const stageDurationsSchema = z.object({
  activity_to_webview_ms: z.number().int().min(0).max(300_000).optional(),
  webview_setup_ms: z.number().int().min(0).max(300_000).optional(),
  document_commit_ms: z.number().int().min(0).max(300_000).optional(),
  page_commit_to_shell_handoff_ms: z.number().int().min(0).max(300_000).optional(),
  profile_bootstrap_ms: z.number().int().min(0).max(300_000).optional(),
  essential_data_ms: z.number().int().min(0).max(300_000).optional(),
}).strict();

const deviceSchema = z.object({
  manufacturer: safeDeviceText,
  model: safeDeviceText,
  android_release: z.string().trim().max(24).regex(/^[0-9A-Za-z ._-]*$/),
  android_api_level: z.number().int().min(24).max(100),
  app_version: z.string().trim().max(40).regex(/^[0-9A-Za-z ._()+-]*$/),
  webview_package: z.string().trim().max(100).regex(/^[0-9A-Za-z._-]*$/),
  webview_version: z.string().trim().max(40).regex(/^[0-9A-Za-z ._+-]*$/),
}).strict();

const eventSchema = z.object({
  event_id: z.string().uuid(),
  captured_at: z.string().datetime({ offset: true }),
  device: deviceSchema,
  startup_ms: z.number().int().min(0).max(300_000).optional(),
  startup_stage_ms: stageDurationsSchema.optional(),
  navigation_ms: z.number().int().min(0).max(300_000).optional(),
  navigation_route: z.enum([
    "home", "learn", "learned", "card_draw", "my_cards", "profile", "leaderboard",
    "ai_practice", "ask", "pricing", "account", "games", "other",
  ]).optional(),
  fps_average: z.number().finite().min(1).max(240).optional(),
  fps_duration_ms: z.number().int().min(1_000).max(30_000).optional(),
  rendered_frames: z.number().int().min(1).max(10_000).optional(),
  janky_frames: z.number().int().min(0).max(10_000).optional(),
}).strict().superRefine((event, context) => {
  const hasStartup = event.startup_ms !== undefined;
  const hasNavigation = event.navigation_ms !== undefined;
  const hasFps = event.fps_average !== undefined;
  if (Number(hasStartup) + Number(hasNavigation) + Number(hasFps) !== 1) {
    context.addIssue({ code: "custom", message: "Each event must contain exactly one measurement type" });
  }
  if (hasNavigation !== (event.navigation_route !== undefined)) {
    context.addIssue({ code: "custom", message: "Navigation duration and route must be provided together" });
  }
  if (hasFps !== (event.fps_duration_ms !== undefined && event.rendered_frames !== undefined && event.janky_frames !== undefined)) {
    context.addIssue({ code: "custom", message: "FPS events require duration and frame counts" });
  }
  if (event.janky_frames !== undefined && event.rendered_frames !== undefined && event.janky_frames > event.rendered_frames) {
    context.addIssue({ code: "custom", message: "Janky frame count cannot exceed the rendered frame count" });
  }
  const capturedAt = Date.parse(event.captured_at);
  if (!Number.isFinite(capturedAt) || capturedAt > Date.now() + 60_000 || capturedAt < Date.now() - 7 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: "custom", message: "Measurement is outside the accepted time window" });
  }
});

const payloadSchema = z.object({ events: z.array(eventSchema).min(1).max(20) }).strict();

async function readSmallJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 30_000) return null;

  const reader = request.body?.getReader();
  if (!reader) return null;

  try {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 30_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("user_performance_diagnostics_settings")
      .select("enabled, policy_version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    return Response.json({
      enabled: data?.enabled === true && data.policy_version === PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
      has_decided: data?.policy_version === PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[analytics.performance] Consent lookup failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const parsed = z.object({
    enabled: z.boolean(),
    policy_version: z.literal(PERFORMANCE_DIAGNOSTICS_POLICY_VERSION),
  }).strict().safeParse(await readSmallJson(request));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error: settingsError } = await admin
      .from("user_performance_diagnostics_settings")
      .upsert({
        user_id: user.id,
        enabled: parsed.data.enabled,
        policy_version: parsed.data.policy_version,
        consented_at: parsed.data.enabled ? now : null,
        updated_at: now,
      }, { onConflict: "user_id" });
    if (settingsError) throw settingsError;

    if (!parsed.data.enabled) {
      const { error } = await admin
        .from("user_performance_summaries")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    }

    return Response.json({ enabled: parsed.data.enabled, policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[analytics.performance] Consent update failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const parsed = payloadSchema.safeParse(await readSmallJson(request));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    const { data: consent, error: consentError } = await admin
      .from("user_performance_diagnostics_settings")
      .select("enabled, policy_version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (consentError) throw consentError;
    if (consent?.enabled !== true || consent.policy_version !== PERFORMANCE_DIAGNOSTICS_POLICY_VERSION) {
      return Response.json({ error: "consent_required" }, { status: 403 });
    }

    const writes = parsed.data.events.map(async (event) => {
      const environmentKey = createHash("sha256")
        .update(JSON.stringify(event.device))
        .digest("hex");
      const metrics = {
        ...(event.startup_ms !== undefined ? { startup_ms: event.startup_ms } : {}),
        ...(event.startup_stage_ms ? {
          startup_stage_ms: Object.fromEntries(
            Object.entries(event.startup_stage_ms).filter(([, value]) => value !== undefined),
          ),
        } : {}),
        ...(event.navigation_ms !== undefined ? {
          navigation_ms: event.navigation_ms,
          navigation_route: event.navigation_route,
        } : {}),
        ...(event.fps_average !== undefined ? {
          fps_average: event.fps_average,
          fps_duration_ms: event.fps_duration_ms,
          rendered_frames: event.rendered_frames,
          janky_frames: event.janky_frames,
        } : {}),
      };

      const { error } = await admin.rpc("record_user_performance_diagnostic", {
        p_user_id: user.id,
        p_event_id: event.event_id,
        p_environment_key: environmentKey,
        p_device: event.device,
        p_metrics: metrics,
      });
      if (error) throw error;
    });
    await Promise.all(writes);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[analytics.performance] Failed to record diagnostics", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
