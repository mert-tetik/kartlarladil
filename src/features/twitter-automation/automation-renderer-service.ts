import "server-only";

import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RendererRecord = {
  id: string;
  owner_key: string;
  label: string;
  active: boolean;
  revoked_at: string | null;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createAutomationRendererToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function registerAutomationRenderer(ownerKey: string, label: string) {
  const token = createAutomationRendererToken();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_renderers")
    .insert({ owner_key: ownerKey, label, token_hash: hashToken(token), capabilities: ["browser_render"] })
    .select("id,owner_key,label,active,created_at")
    .single();
  if (error || !data) throw new Error("automation_renderer_register_failed");
  return { renderer: data, token };
}

export async function authenticateAutomationRenderer(token: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_renderers")
    .select("id,owner_key,label,active,revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<RendererRecord>();
  if (error || !data || !data.active || data.revoked_at) return null;
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("social_content_automation_renderers").update({ last_seen_at: now, last_heartbeat_at: now, updated_at: now }).eq("id", data.id).eq("active", true);
  if (updateError) throw new Error("automation_renderer_heartbeat_failed");
  return data;
}

export async function heartbeatAutomationRenderer(rendererId: string, ownerKey: string) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("social_content_automation_renderers")
    .update({ last_seen_at: now, last_heartbeat_at: now, updated_at: now })
    .eq("id", rendererId)
    .eq("owner_key", ownerKey)
    .eq("active", true)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("automation_renderer_heartbeat_failed");
}
