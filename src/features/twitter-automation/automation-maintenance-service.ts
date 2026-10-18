import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUTOMATION_BUCKET = "social-studio-automation";
const STORAGE_PAGE_SIZE = 1_000;
const STORAGE_DELETE_BATCH_SIZE = 1_000;
const MAX_PURGE_PASSES = 3;
const ACTIVE_SCHEDULE_STALE_MS = 15 * 60_000;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type ListedStorageEntry = {
  id: string | null;
  name: string;
};

async function listAllAutomationMediaPaths(supabase: AdminClient) {
  const bucket = supabase.storage.from(AUTOMATION_BUCKET);
  const directories = [""];
  const visitedDirectories = new Set<string>();
  const paths = new Set<string>();

  while (directories.length) {
    const directory = directories.pop()!;
    if (visitedDirectories.has(directory)) continue;
    visitedDirectories.add(directory);

    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      const { data, error } = await bucket.list(directory, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("automation_media_cleanup_list_failed");

      for (const entry of (data ?? []) as ListedStorageEntry[]) {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.id === null) directories.push(path);
        else paths.add(path);
      }

      if (!data || data.length < STORAGE_PAGE_SIZE) break;
    }
  }

  return [...paths];
}

async function deleteAllAutomationRunRows(supabase: AdminClient) {
  const { error } = await supabase
    .from("social_content_automation_runs")
    .delete()
    .not("id", "is", null);
  if (error) throw new Error("automation_run_cleanup_delete_failed");
}

async function getAutomationRunCounts(supabase: AdminClient) {
  const [{ count: runs, error: runsError }, { count: outputs, error: outputsError }] = await Promise.all([
    supabase.from("social_content_automation_runs").select("id", { count: "exact", head: true }),
    supabase.from("social_content_automation_outputs").select("id", { count: "exact", head: true }),
  ]);
  if (runsError || outputsError) throw new Error("automation_run_cleanup_count_failed");
  return { runs: runs ?? 0, outputs: outputs ?? 0 };
}

async function removeAutomationMediaPaths(supabase: AdminClient, paths: string[]) {
  const bucket = supabase.storage.from(AUTOMATION_BUCKET);
  let removed = 0;

  for (let offset = 0; offset < paths.length; offset += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(offset, offset + STORAGE_DELETE_BATCH_SIZE);
    const { error } = await bucket.remove(batch);
    if (error) throw new Error("automation_media_cleanup_failed");
    removed += batch.length;
  }

  return removed;
}

export async function cleanupAllAutomationRunData(supabase = createSupabaseAdminClient()) {
  const activeScheduleCutoff = Date.now() - ACTIVE_SCHEDULE_STALE_MS;
  let preservedSchedules = 0;
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("social_content_automation_outputs")
      .select("id,schedule_status,schedule_error_code,schedule_attempted_at")
      .eq("schedule_status", "processing")
      .range(offset, offset + STORAGE_PAGE_SIZE - 1)
      .returns<Array<{ id: string; schedule_status: string; schedule_error_code: string | null; schedule_attempted_at: string | null }>>();
    if (error) throw new Error("automation_schedule_cleanup_guard_failed");

    preservedSchedules += (data ?? []).filter((output) => {
      if (output.schedule_error_code === "upload_post_request_unconfirmed") return true;
      const attemptedAt = output.schedule_attempted_at ? Date.parse(output.schedule_attempted_at) : Number.NaN;
      return !Number.isFinite(attemptedAt) || attemptedAt >= activeScheduleCutoff;
    }).length;
    if (!data || data.length < STORAGE_PAGE_SIZE) break;
  }

  if (preservedSchedules) {
    // Upload-Post can still be fetching a staged video URL in the background.
    // Preserve both the request record and source media until reconciliation.
    return {
      deletedRuns: 0,
      deletedOutputs: 0,
      removedMedia: 0,
      deferred: true as const,
      preservedSchedules,
    };
  }

  // Inventory the dedicated bucket before destructive database changes, so a
  // Storage listing failure leaves run history intact for the next cron retry.
  let mediaPaths = await listAllAutomationMediaPaths(supabase);
  const countsBefore = await getAutomationRunCounts(supabase);

  let removedMedia = 0;
  for (let pass = 0; pass < MAX_PURGE_PASSES; pass += 1) {
    await deleteAllAutomationRunRows(supabase);
    removedMedia += await removeAutomationMediaPaths(supabase, mediaPaths);

    mediaPaths = await listAllAutomationMediaPaths(supabase);
    const remainingCounts = await getAutomationRunCounts(supabase);
    if (!mediaPaths.length && !remainingCounts.runs && !remainingCounts.outputs) {
      return {
        deletedRuns: countsBefore.runs,
        deletedOutputs: countsBefore.outputs,
        removedMedia,
      };
    }
  }

  throw new Error("automation_run_cleanup_incomplete");
}
