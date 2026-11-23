import { z } from "zod";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionPayloadSchema = z.object({
  action: z.enum(["start", "heartbeat", "end"]),
  session_id: z.string().uuid(),
  platform: z.enum(["web", "twa"]).optional(),
  end_reason: z.enum(["pagehide", "logout", "native_pause", "timeout", "unknown"]).optional(),
}).strict().superRefine((payload, context) => {
  if (payload.action === "start" && !payload.platform) {
    context.addIssue({ code: "custom", path: ["platform"], message: "Session starts require a platform" });
  }
  if (payload.action === "end" && !payload.end_reason) {
    context.addIssue({ code: "custom", path: ["end_reason"], message: "Session ends require an end reason" });
  }
  if (payload.action !== "end" && payload.end_reason !== undefined) {
    context.addIssue({ code: "custom", path: ["end_reason"], message: "Only session ends may include an end reason" });
  }
});

async function readPayload(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4_000) return null;
  return request.json().catch(() => null);
}

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  // Analytics must never turn an expired auth session into a visible app error.
  if (!user) return new Response(null, { status: 204 });

  const parsed = sessionPayloadSchema.safeParse(await readPayload(request));
  if (!parsed.success) return new Response(null, { status: 204 });

  const { action, session_id: sessionId, platform, end_reason: endReason } = parsed.data;
  const now = new Date().toISOString();

  try {
    const admin = createSupabaseAdminClient();

    if (action === "start") {
      const { error } = await admin
        .from("analytics_sessions")
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          platform,
          started_at: now,
          last_seen_at: now,
        }, { onConflict: "session_id", ignoreDuplicates: true });
      if (error) throw error;
    } else if (action === "heartbeat") {
      const { data, error } = await admin
        .from("analytics_sessions")
        .update({ last_seen_at: now })
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .select("session_id")
        .maybeSingle();
      if (error) throw error;

      // Retry the start implicitly if the very first request was lost before
      // the next heartbeat. An already-ended session is never reopened.
      if (!data) {
        const fallback = await admin
          .from("analytics_sessions")
          .insert({
            session_id: sessionId,
            user_id: user.id,
            platform: platform ?? "web",
            started_at: now,
            last_seen_at: now,
          });
        if (fallback.error && fallback.error.code !== "23505") throw fallback.error;
      }
    } else {
      const { data, error } = await admin
        .from("analytics_sessions")
        .update({ last_seen_at: now, ended_at: now, end_reason: endReason })
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .select("session_id")
        .maybeSingle();
      if (error) throw error;

      // A very short session can close before the start request finishes. Keep
      // that session visible instead of losing it to a missing start row.
      if (!data) {
        const fallback = await admin
          .from("analytics_sessions")
          .insert({
            session_id: sessionId,
            user_id: user.id,
            platform: platform ?? "web",
            started_at: now,
            last_seen_at: now,
            ended_at: now,
            end_reason: endReason,
          });
        if (fallback.error && fallback.error.code !== "23505") throw fallback.error;
      }
    }
  } catch (error) {
    console.error("[analytics.sessions] Failed to record session telemetry", {
      action,
      error,
    });
  }

  return new Response(null, { status: 204 });
}
