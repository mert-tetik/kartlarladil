import "server-only";

import { getProfileUserFingerprint } from "@/features/auth/profile-observability";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUTH_PAGE_SIZE = 100;
const PROFILE_PAGE_SIZE = 1000;
const PROFILE_CREATE_GRACE_PERIOD_MS = 15 * 60 * 1000;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type AuthAccount = { id: string; created_at: string };

export interface ProfileHealthReport {
  scannedAt: string;
  authUsers: number;
  profiles: number;
  missingProfiles: number;
  actionableMissingProfiles: number;
  pendingWithinGracePeriod: number;
  missingCreatedWithin24Hours: number;
  missingCreatedWithin7Days: number;
  sampleFingerprints: string[];
}

async function readAllAuthAccounts(supabase: AdminClient): Promise<AuthAccount[]> {
  const accounts: AuthAccount[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error || !data?.users) throw new Error("auth_users_read_failed");

    accounts.push(...data.users.map((user) => ({ id: user.id, created_at: user.created_at })));

    if (data.users.length < AUTH_PAGE_SIZE) break;
    if (data.total != null && accounts.length >= data.total) break;
  }

  return accounts;
}

async function readProfileUserIds(supabase: AdminClient): Promise<Set<string>> {
  const userIds = new Set<string>();

  for (let from = 0; ; from += PROFILE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id")
      .order("user_id")
      .range(from, from + PROFILE_PAGE_SIZE - 1);

    if (error || !data) throw new Error("user_profiles_read_failed");
    for (const row of data) userIds.add(row.user_id);
    if (data.length < PROFILE_PAGE_SIZE) break;
  }

  return userIds;
}

export async function scanAuthProfileHealth(
  supabase: AdminClient,
  now = new Date(),
): Promise<ProfileHealthReport> {
  const [accounts, profileUserIds] = await Promise.all([
    readAllAuthAccounts(supabase),
    readProfileUserIds(supabase),
  ]);
  const nowMs = now.getTime();
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const graceCutoff = nowMs - PROFILE_CREATE_GRACE_PERIOD_MS;
  const missing = accounts.filter((account) => !profileUserIds.has(account.id));
  const actionableMissing = missing.filter((account) => Date.parse(account.created_at) < graceCutoff);
  const pendingWithinGracePeriod = missing.length - actionableMissing.length;
  const recentMissing = missing.filter((account) => Date.parse(account.created_at) >= oneDayAgo);
  const weeklyMissing = missing.filter((account) => Date.parse(account.created_at) >= sevenDaysAgo);

  return {
    scannedAt: now.toISOString(),
    authUsers: accounts.length,
    profiles: profileUserIds.size,
    missingProfiles: missing.length,
    actionableMissingProfiles: actionableMissing.length,
    pendingWithinGracePeriod,
    missingCreatedWithin24Hours: recentMissing.length,
    missingCreatedWithin7Days: weeklyMissing.length,
    sampleFingerprints: actionableMissing.slice(0, 20).map((account) => getProfileUserFingerprint(account.id)),
  };
}
