import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const POYO_PROVIDER_NAME = "poyo_responses";
const FAILURE_WINDOW_SECONDS = 2 * 60;
const CIRCUIT_OPEN_SECONDS = 5 * 60;

type ProviderHealthRecord = {
  open_until: string | null;
};

export async function isSocialStudioPoyoCircuitOpen(now = Date.now()) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_provider_health")
    .select("open_until")
    .eq("provider_name", POYO_PROVIDER_NAME)
    .maybeSingle<ProviderHealthRecord>();
  if (error) throw new Error("social_studio_provider_health_read_failed");

  const openUntil = data?.open_until ? new Date(data.open_until).getTime() : Number.NaN;
  return Number.isFinite(openUntil) && openUntil > now;
}

export async function recordSocialStudioPoyoRetryableFailure() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("record_social_content_automation_provider_failure", {
    p_provider_name: POYO_PROVIDER_NAME,
    p_failure_window_seconds: FAILURE_WINDOW_SECONDS,
    p_circuit_open_seconds: CIRCUIT_OPEN_SECONDS,
  });
  if (error) throw new Error("social_studio_provider_health_write_failed");
}

export async function recordSocialStudioPoyoSuccess() {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("social_content_automation_provider_health")
    .upsert({
      provider_name: POYO_PROVIDER_NAME,
      consecutive_failures: 0,
      last_failure_at: null,
      last_success_at: now,
      open_until: null,
      updated_at: now,
    }, { onConflict: "provider_name" });
  if (error) throw new Error("social_studio_provider_health_write_failed");
}
