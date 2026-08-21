import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const POYO_PROVIDER_NAME = "poyo_responses";
const OPENAI_PROVIDER_NAME = "openai_responses";
const POYO_FAILURE_WINDOW_SECONDS = 2 * 60;
const POYO_CIRCUIT_OPEN_SECONDS = 5 * 60;
const OPENAI_FAILURE_WINDOW_SECONDS = 90;
const OPENAI_CIRCUIT_OPEN_SECONDS = 90;
const OPENAI_MAX_CONCURRENCY = 2;
const OPENAI_LEASE_SECONDS = 90;

type ProviderName = typeof POYO_PROVIDER_NAME | typeof OPENAI_PROVIDER_NAME;

type ProviderHealthRecord = {
  open_until: string | null;
};

export type SocialStudioProviderLease = {
  id: string;
  release: () => Promise<void>;
};

async function isSocialStudioProviderCircuitOpen(providerName: ProviderName, now = Date.now()) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_provider_health")
    .select("open_until")
    .eq("provider_name", providerName)
    .maybeSingle<ProviderHealthRecord>();
  if (error) throw new Error("social_studio_provider_health_read_failed");

  const openUntil = data?.open_until ? new Date(data.open_until).getTime() : Number.NaN;
  return Number.isFinite(openUntil) && openUntil > now;
}

async function recordSocialStudioProviderRetryableFailure(
  providerName: ProviderName,
  failureWindowSeconds: number,
  circuitOpenSeconds: number,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("record_social_content_automation_provider_failure", {
    p_provider_name: providerName,
    p_failure_window_seconds: failureWindowSeconds,
    p_circuit_open_seconds: circuitOpenSeconds,
  });
  if (error) throw new Error("social_studio_provider_health_write_failed");
}

async function recordSocialStudioProviderSuccess(providerName: ProviderName) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("social_content_automation_provider_health")
    .upsert({
      provider_name: providerName,
      consecutive_failures: 0,
      last_failure_at: null,
      last_success_at: now,
      open_until: null,
      updated_at: now,
    }, { onConflict: "provider_name" });
  if (error) throw new Error("social_studio_provider_health_write_failed");
}

export async function isSocialStudioPoyoCircuitOpen(now = Date.now()) {
  return await isSocialStudioProviderCircuitOpen(POYO_PROVIDER_NAME, now);
}

export async function recordSocialStudioPoyoRetryableFailure() {
  await recordSocialStudioProviderRetryableFailure(
    POYO_PROVIDER_NAME,
    POYO_FAILURE_WINDOW_SECONDS,
    POYO_CIRCUIT_OPEN_SECONDS,
  );
}

export async function recordSocialStudioPoyoSuccess() {
  await recordSocialStudioProviderSuccess(POYO_PROVIDER_NAME);
}

export async function isSocialStudioOpenAICircuitOpen(now = Date.now()) {
  return await isSocialStudioProviderCircuitOpen(OPENAI_PROVIDER_NAME, now);
}

export async function recordSocialStudioOpenAIRetryableFailure() {
  await recordSocialStudioProviderRetryableFailure(
    OPENAI_PROVIDER_NAME,
    OPENAI_FAILURE_WINDOW_SECONDS,
    OPENAI_CIRCUIT_OPEN_SECONDS,
  );
}

export async function recordSocialStudioOpenAISuccess() {
  await recordSocialStudioProviderSuccess(OPENAI_PROVIDER_NAME);
}

/** Acquire a short service-role-only capacity lease before a direct OpenAI
 * fallback. Expired leases are swept atomically by the RPC, so a crashed route
 * cannot permanently starve the queue. */
export async function acquireSocialStudioOpenAILease(): Promise<SocialStudioProviderLease | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("acquire_social_content_automation_provider_lease", {
    p_provider_name: OPENAI_PROVIDER_NAME,
    p_max_concurrency: OPENAI_MAX_CONCURRENCY,
    p_lease_seconds: OPENAI_LEASE_SECONDS,
  });
  if (error) throw new Error("social_studio_provider_lease_acquire_failed");
  if (typeof data !== "string" || !data) return null;

  return {
    id: data,
    release: async () => {
      const { error: releaseError } = await supabase
        .from("social_content_automation_provider_leases")
        .delete()
        .eq("id", data)
        .eq("provider_name", OPENAI_PROVIDER_NAME);
      if (releaseError) throw new Error("social_studio_provider_lease_release_failed");
    },
  };
}
