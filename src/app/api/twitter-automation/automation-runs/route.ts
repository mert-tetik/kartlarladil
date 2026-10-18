import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioAutomationSession, hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { RANDOM_GENERATOR, resolveGeneratorSelection } from "@/features/twitter-automation/automation-randomization";
import { AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS } from "@/features/twitter-automation/automation-resilience";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { listAutomationStoragePaths, logAutomationRequestFailure } from "@/features/twitter-automation/automation-run-service";
import { buildLanguageCombinationPlan } from "@/features/twitter-automation/language-combination-planning";
import { buildSharedPoolPlan, type SharedPoolSource } from "@/features/twitter-automation/shared-pool-planning";
import {
  createDailyAutomationOutputMetadata,
  readDailyAutomationOutputMetadata,
  createRunAutomationOutputIdentity,
} from "@/features/twitter-automation/daily-automation-output";
import { getSocialDownloadTitle } from "@/features/twitter-automation/social-video-titles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_TABLE = "social_content_automation_state";
const AUTOMATION_BUCKET = "social-studio-automation";
const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const BROWSER_IMAGE_GENERATORS = new Set([
  "word-of-the-day",
  "word-of-the-day-poster",
  "self-mini-quiz",
  "self-false-friends",
  "self-daily-challenge",
  "self-vocabulary-progression",
  "self-example-sentences",
  "vocabulary-carousel",
  "tier-progression-carousel",
]);
const BROWSER_MUSIC_IMAGE_GENERATORS = new Set([
  "music-word-of-the-day",
  "music-word-of-the-day-poster",
  "music-self-mini-quiz",
  "music-self-false-friends",
  "music-self-daily-challenge",
  "music-self-vocabulary-progression",
  "music-self-example-sentences",
]);
const OTHER_BROWSER_VIDEO_GENERATORS = new Set([
  "confused-words-video",
  "marketing-dialogue-video",
  "learning-dialogue-video",
  "tier-progression-video",
  "vocabulary-quiz-video",
  "sentence-check-video",
  "sentence-translation-video",
]);
const languageSelectionSchema = z.enum(["random", ...LANGUAGE_CODES]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
const selectableContentTypeSchema = z.enum(["text", "image", "video"]);
const generatorModesSchema = z.object({
  text: z.string().trim().min(1).max(120).optional(),
  image: z.string().trim().min(1).max(120).optional(),
  video: z.string().trim().min(1).max(120).optional(),
}).strict();
const randomIncludesSchema = z.object({
  text: z.array(z.enum(["ai"])).min(1).max(1).optional(),
  image: z.array(z.enum(["self", "ai"])).min(1).max(2).optional(),
  video: z.array(z.enum(["ai", "self", "img"])).min(1).max(3).optional(),
}).strict();
const dailyQuantitiesSchema = z.object({
  text: z.number().int().min(0).max(20),
  image: z.number().int().min(0).max(20),
  video: z.number().int().min(0).max(20),
}).strict();
const accountContentTypesSchema = z.record(z.string(), z.array(selectableContentTypeSchema).max(3));
const rowSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["random", "text", "image", "video"]),
  generator: z.string().trim().min(1).max(120),
  contentTypes: z.array(selectableContentTypeSchema).min(1).max(3).optional(),
  generators: generatorModesSchema.optional(),
  randomIncludes: randomIncludesSchema.optional(),
  dailyQuantities: dailyQuantitiesSchema.optional(),
  accountContentTypes: accountContentTypesSchema.optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  language: languageSelectionSchema,
  nativeLanguage: languageSelectionSchema,
  tier: z.enum(["random", "A1", "A2", "B1", "B2", "C1"]),
  accounts: z.record(z.string(), z.array(z.string().regex(/^\d+$/u)).min(1)).refine((accounts) => Object.values(accounts).flat().length > 0),
  scheduleStart: timeSchema,
  scheduleEnd: timeSchema,
}).passthrough().refine((row) => row.scheduleStart < row.scheduleEnd, { path: ["scheduleEnd"], message: "Schedule end must be later than start." });
const groupsSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  superGroupId: z.string().uuid().optional(),
  hidden: z.boolean().optional(),
  rows: z.array(rowSchema).min(1).max(100),
}).passthrough()).min(1).max(30);
const superGroupsSchema = z.array(z.object({
  id: z.string().uuid(),
  hidden: z.boolean().optional(),
}).passthrough()).max(30).default([]);
const storedAutomationStateSchema = z.union([groupsSchema, z.object({ groups: groupsSchema, superGroups: superGroupsSchema }).passthrough()]);
const requestSchema = z.object({
  horizonDays: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  requestKey: z.string().uuid().optional(),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

type AutomationRow = z.infer<typeof rowSchema>;
type SelectableContentType = z.infer<typeof selectableContentTypeSchema>;
type OutputLanguage = (typeof LANGUAGE_CODES)[number];
type PlannedOutput = {
  id: string;
  generationKey: string;
  generationDate: string;
  dayOffset: number;
  combinationId: string;
  generationIndex: number;
  groupName: string;
  contentType: SelectableContentType;
  generator: string;
  language: OutputLanguage;
  nativeLanguage: OutputLanguage;
  tier: AutomationRow["tier"];
  scheduledAt: string;
  targetIds: number[];
};

async function isAuthorized(request: NextRequest) {
  return await hasSocialStudioAutomationSession(request.headers.get("cookie"));
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

function createScheduledAt(scheduleDate: string, dayOffset: number, start: string, end: string) {
  const [year, month, day] = addCalendarDays(scheduleDate, dayOffset - 1).split("-").map(Number);
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const minute = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes + 1));
  const hour = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hour}:${minutes}:00+03:00`;
}

function generationDateForDayOffset(scheduleDate: string, dayOffset: number) {
  return addCalendarDays(scheduleDate, dayOffset - 1);
}

function targetAccountIds(row: AutomationRow) {
  return [...new Set(Object.values(row.accounts).flat().map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
}

function seededRandom(seed: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

function createReservedScheduledAt(scheduleDate: string, dayOffset: number, start: string, end: string, accountIds: number[], reservations: Map<number, number[]>) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = createScheduledAt(scheduleDate, dayOffset, start, end);
    const candidateTime = new Date(candidate).getTime();
    if (!Number.isFinite(candidateTime)) continue;
    const hasConflict = accountIds.some((accountId) => (reservations.get(accountId) ?? []).some((reservedAt) => Math.abs(reservedAt - candidateTime) < AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS));
    if (hasConflict) continue;
    for (const accountId of accountIds) reservations.set(accountId, [...(reservations.get(accountId) ?? []), candidateTime]);
    return candidate;
  }
  return null;
}

function pickLanguage(candidates: readonly OutputLanguage[] = LANGUAGE_CODES, random = Math.random) {
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!;
}

function resolveOutputLanguages(row: AutomationRow, random = Math.random) {
  const language = row.language === "random" ? pickLanguage(LANGUAGE_CODES, random) : row.language;
  if (row.nativeLanguage !== "random") return { language, nativeLanguage: row.nativeLanguage };
  return { language, nativeLanguage: pickLanguage(LANGUAGE_CODES.filter((candidate) => candidate !== language), random) };
}

function resolveContentMode(row: AutomationRow, forcedContentType?: SelectableContentType, random = Math.random) {
  if (forcedContentType) {
    const generatorMode = row.generators?.[forcedContentType]
      ?? (row.contentType === forcedContentType ? row.generator : RANDOM_GENERATOR);
    return { contentType: forcedContentType, generator: resolveGeneratorSelection(forcedContentType, generatorMode, row.randomIncludes?.[forcedContentType], random) };
  }
  const selectedTypes: SelectableContentType[] = row.contentTypes?.length
    ? [...new Set(row.contentTypes)]
    : row.contentType === "image"
      ? ["image"]
      : row.contentType === "text"
        ? ["text"]
        : row.contentType === "video"
          ? ["video"]
          : ["text", "image", "video"];
  const contentType = selectedTypes[Math.min(selectedTypes.length - 1, Math.floor(random() * selectedTypes.length))]!;
  const generatorMode = row.generators?.[contentType]
    ?? (row.contentType === contentType ? row.generator : RANDOM_GENERATOR);
  const generator = resolveGeneratorSelection(contentType, generatorMode, row.randomIncludes?.[contentType], random);

  return { contentType, generator };
}

function requiresBrowserRenderer(generator: string) {
  if (BROWSER_MUSIC_IMAGE_GENERATORS.has(generator)) return true;
  if (generator.startsWith("music-")) return false;
  return BROWSER_IMAGE_GENERATORS.has(generator) || OTHER_BROWSER_VIDEO_GENERATORS.has(generator);
}

async function toMediaUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("https://")) return path;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).createSignedUrl(path, 60 * 60);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

function mediaPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((path): path is string => typeof path === "string" && path.startsWith("automation/")))];
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));
  const requestedRunId = request.nextUrl.searchParams.get("runId");
  const latestOnly = request.nextUrl.searchParams.get("latest") === "1";
  const activeOnly = request.nextUrl.searchParams.get("active") === "1";
  const includeMedia = request.nextUrl.searchParams.get("includeMedia") === "1";
  if (requestedRunId && !z.string().uuid().safeParse(requestedRunId).success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  let runId: string | null = requestedRunId;
  let latestRun: { id: string; horizon_days: number; status: string; created_at: string; schedule_date: string; generation_stopped_at: string | null; finished_by_user_at: string | null } | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    if (!runId && latestOnly) {
      const { data, error: latestRunError } = await supabase
        .from("social_content_automation_runs")
        .select("id,horizon_days,status,created_at,schedule_date,generation_stopped_at,finished_by_user_at")
        .eq("owner_key", ownerKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRunError) {
        logAutomationRequestFailure("automation_latest_run_read_failed", latestRunError, { scope: ownerKey });
        return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
      }
      latestRun = data;
      runId = latestRun?.id ?? null;
      if (!runId) return NextResponse.json({ outputs: [], durationProfiles: {}, latestRunId: null, latestRun: null });
    }
    const outputLimit = runId ? 1_000 : 300;
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,last_error_detail,last_provider,last_provider_status,last_provider_attempt_count,last_provider_request_id,attempt_count,next_attempt_at,last_error_class,quality_status,quality_error,quality_checked_at,lease_renderer_id,lease_expires_at,renderer_heartbeat_at,render_plan,generation_attempt_started_at,duration_recorded_at,created_at,updated_at,generated_at,scheduled_at_upload_post,schedule_status,schedule_error_code,schedule_error_detail,schedule_attempt_count,schedule_attempted_at,schedule_completed_at,run:social_content_automation_runs!inner(id,horizon_days,status,created_at,schedule_date,generation_stopped_at,finished_by_user_at,preflight_status,preflight_details,auto_schedule_on_success,auto_schedule_error)")
      .eq("run.owner_key", ownerKey)
      .order("scheduled_at", { ascending: true })
      .limit(outputLimit);
    if (runId) query = query.eq("run_id", runId);
    if (activeOnly) query = query.in("run.status", ["queued", "processing", "ready_to_schedule"]);
    const { data, error } = await query;
    if (error) {
      logAutomationRequestFailure("automation_runs_read_failed", error, { runId: runId ?? null, scope: ownerKey });
      return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    }
    const storagePathsPromise = includeMedia ? listAutomationStoragePaths() : Promise.resolve<Set<string> | null>(null);
    const durationProfiles = runId
      ? await supabase
        .from("social_content_automation_mode_durations")
        .select("generator,average_duration_ms")
        .then(({ data, error: durationError }) => durationError ? {} : Object.fromEntries((data ?? [])
          .filter((profile): profile is { generator: string; average_duration_ms: number } => typeof profile.generator === "string" && Number.isFinite(profile.average_duration_ms) && profile.average_duration_ms > 0)
          .map((profile) => [profile.generator, profile.average_duration_ms])))
      : {};
    let storagePaths: Set<string> | null = null;
    let storageStatusUnavailable = false;
    if (includeMedia) {
      try {
        storagePaths = await storagePathsPromise;
      } catch (error) {
        storageStatusUnavailable = true;
        logAutomationRequestFailure("automation_storage_status_read_failed", error, { runId: runId ?? null, scope: ownerKey });
      }
    }
    const outputs = await Promise.all((data ?? []).map(async (output) => {
      const durableMetadata = readDailyAutomationOutputMetadata(output.render_plan);
      const needsBrowserVideoSource = output.status === "awaiting_browser_video" && typeof output.media_path === "string";
      const outputPaths = [...mediaPaths(output.media_paths), ...(typeof output.media_path === "string" && output.media_path.startsWith("automation/") ? [output.media_path] : [])];
      const bucketStatus = output.content_type === "text"
        ? "database"
        : !includeMedia
          ? "not_checked"
          : storageStatusUnavailable
            ? "unavailable"
            : outputPaths.length > 0 && outputPaths.every((path) => storagePaths?.has(path))
              ? "stored"
              : "missing";
      const durableOutputFields = {
        generation_key: durableMetadata?.generationKey ?? null,
        generation_date: durableMetadata?.generationDate ?? null,
        generation_index: durableMetadata?.generationIndex ?? null,
        title: durableMetadata?.title ?? null,
        description: durableMetadata?.description ?? output.caption ?? null,
      };
      if (!includeMedia && !needsBrowserVideoSource) return { ...output, ...durableOutputFields, mediaUrl: null, mediaUrls: [], bucketStatus };
      const paths = mediaPaths(output.media_paths);
      const mediaUrls = await Promise.all(paths.map((path) => toMediaUrl(path)));
      return {
        ...output,
        ...durableOutputFields,
        bucketStatus,
        mediaUrl: await toMediaUrl(typeof output.media_path === "string" ? output.media_path : null),
        mediaUrls: mediaUrls.filter((url): url is string => Boolean(url)),
      };
    }));
    return NextResponse.json({ outputs, durationProfiles, latestRunId: latestRun?.id ?? (runId ?? null), latestRun });
  } catch (error) {
    logAutomationRequestFailure("automation_runs_read_request_failed", error, { runId: runId ?? null, scope: ownerKey });
    return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!await hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ errorCode: "invalid_automation_horizon" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsedRequest.data.scope));

  try {
    const supabase = createSupabaseAdminClient();
    const { data: state, error: stateError } = await supabase.from(STATE_TABLE).select("groups").eq("owner_key", ownerKey).maybeSingle<{ groups: unknown }>();
    if (stateError) {
      logAutomationRequestFailure("automation_state_read_failed", stateError, { scope: ownerKey });
      return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
    }
    const parsedState = storedAutomationStateSchema.safeParse(state?.groups);
    if (!parsedState.success) {
      logAutomationRequestFailure("automation_state_invalid", new Error("invalid_automation_state"), { scope: ownerKey, issueCount: parsedState.error.issues.length });
      return NextResponse.json({ errorCode: "invalid_automation_state" }, { status: 409 });
    }
    const parsedGroups = Array.isArray(parsedState.data) ? parsedState.data : parsedState.data.groups;
    const hiddenSuperGroupIds = new Set(Array.isArray(parsedState.data) ? [] : parsedState.data.superGroups.filter((superGroup) => superGroup.hidden).map((superGroup) => superGroup.id));

    const sourceRows = parsedGroups.filter((group) => !group.hidden && (!group.superGroupId || !hiddenSuperGroupIds.has(group.superGroupId))).flatMap((group) => group.rows.map((row) => ({ group, row, targetIds: targetAccountIds(row) }))).filter((item) => item.targetIds.length > 0);
    if (!sourceRows.length) {
      logAutomationRequestFailure("automation_targets_missing", new Error("automation_targets_missing"), { scope: ownerKey });
      return NextResponse.json({ errorCode: "automation_targets_missing" }, { status: 409 });
    }

    const selectedAccountIds = [...new Set(sourceRows.flatMap((item) => item.targetIds))];
    const [{ data: accountRows, error: accountError }, { error: storageError }] = await Promise.all([
      supabase.from("social_medias").select("id").in("id", selectedAccountIds),
      supabase.storage.from(AUTOMATION_BUCKET).list("", { limit: 1 }),
    ]);
    if (accountError || (accountRows?.length ?? 0) !== selectedAccountIds.length) {
      logAutomationRequestFailure("automation_preflight_accounts_failed", accountError ?? new Error("automation_account_count_mismatch"), { scope: ownerKey, selectedAccountCount: selectedAccountIds.length, foundAccountCount: accountRows?.length ?? 0 });
      return NextResponse.json({ errorCode: "automation_preflight_accounts_failed" }, { status: 409 });
    }
    if (storageError) {
      logAutomationRequestFailure("automation_preflight_storage_failed", storageError, { scope: ownerKey });
      return NextResponse.json({ errorCode: "automation_preflight_storage_failed" }, { status: 503 });
    }

    const isProductionPool = normalizeAutomationScope(parsedRequest.data.scope) === "production";
    const hasLanguageCombinationRows = isProductionPool && sourceRows.some(({ row }) => Boolean(row.dailyQuantities));
    const combinationPlanningSources = hasLanguageCombinationRows
      ? buildLanguageCombinationPlan(sourceRows.map(({ group, row }) => ({ group, row })))
      : [];
    const legacyPlanningSources = !hasLanguageCombinationRows && isProductionPool
      ? buildSharedPoolPlan(sourceRows as SharedPoolSource<typeof sourceRows[number]["group"], typeof sourceRows[number]["row"]>[])
      : [];
    const testPlanningSources = !isProductionPool
      ? sourceRows.map(({ group, row, targetIds }) => ({ group, row, targetIdsByOutput: Array.from({ length: row.quantity }, () => targetIds) }))
      : [];
    const outputsPerDay = hasLanguageCombinationRows
      ? combinationPlanningSources.reduce((total, item) => total + item.quantity, 0)
      : (isProductionPool ? legacyPlanningSources : testPlanningSources).reduce((total, item) => total + item.row.quantity, 0);
    const { data: existingSchedules, error: scheduleError } = await supabase
      .from("social_content_automation_outputs")
      .select("id,scheduled_at,target_account_ids,run:social_content_automation_runs!inner(owner_key)")
      .eq("run.owner_key", ownerKey)
      .gte("scheduled_at", new Date().toISOString())
      .in("status", ["queued", "processing", "generating_video", "awaiting_browser_image", "awaiting_browser_video", "ready_to_schedule", "scheduled"])
      .limit(2_000);
    if (scheduleError) {
      logAutomationRequestFailure("automation_preflight_schedule_failed", scheduleError, { scope: ownerKey });
      return NextResponse.json({ errorCode: "automation_preflight_schedule_failed" }, { status: 503 });
    }
    const requestKey = parsedRequest.data.requestKey ?? randomUUID();
    const { data: allocatedRunRows, error: allocationError } = await supabase.rpc("create_social_content_automation_run", {
      p_owner_key: ownerKey,
      p_request_key: requestKey,
      p_horizon_days: parsedRequest.data.horizonDays,
      p_total_outputs: outputsPerDay * parsedRequest.data.horizonDays,
      p_preflight_details: { storage: "passed", accounts: selectedAccountIds.length, scheduleGapMinutes: AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS / 60_000, renderer: "checking" },
    });
    const allocatedRun = Array.isArray(allocatedRunRows) ? allocatedRunRows[0] as { id?: string; schedule_date?: string; was_created?: boolean } | undefined : undefined;
    if (allocationError || !allocatedRun?.id || !allocatedRun.schedule_date) {
      logAutomationRequestFailure("automation_run_create_failed", allocationError ?? new Error("automation_run_missing_after_allocation"), { scope: ownerKey, outputCount: outputsPerDay * parsedRequest.data.horizonDays });
      return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });
    }
    const runId = allocatedRun.id;
    const { data: run, error: runReadError } = await supabase
      .from("social_content_automation_runs")
      .select("id,horizon_days,created_at,schedule_date,status,generation_stopped_at,finished_by_user_at")
      .eq("id", runId)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runReadError || !run) {
      logAutomationRequestFailure("automation_durable_run_read_failed", runReadError ?? new Error("automation_run_missing"), { scope: ownerKey, runId });
      return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    }
    if (run.generation_stopped_at || run.finished_by_user_at) return NextResponse.json({ errorCode: "automation_run_already_closed" }, { status: 409 });

    const planSlots: Array<{
      dayOffset: number;
      slotKey: string;
      group: { name: string };
      row: AutomationRow;
      generationIndex: number;
      forcedContentType?: SelectableContentType;
      fallbackTargetIds: number[];
    }> = [];
    for (let dayOffset = 1; dayOffset <= parsedRequest.data.horizonDays; dayOffset += 1) {
      if (hasLanguageCombinationRows) {
        for (const { group, row, contentType, quantity, targetIds } of combinationPlanningSources) {
          for (let outputIndex = 0; outputIndex < quantity; outputIndex += 1) {
            planSlots.push({ dayOffset, slotKey: `day-${dayOffset}:row-${row.id}:${contentType}:${outputIndex + 1}`, group, row, generationIndex: outputIndex + 1, forcedContentType: contentType, fallbackTargetIds: targetIds.map(Number) });
          }
        }
      } else {
        const sources = isProductionPool ? legacyPlanningSources : testPlanningSources;
        for (const { group, row, targetIdsByOutput } of sources) {
          for (let outputIndex = 0; outputIndex < row.quantity; outputIndex += 1) {
            planSlots.push({ dayOffset, slotKey: `day-${dayOffset}:row-${row.id}:item-${outputIndex + 1}`, group, row, generationIndex: outputIndex + 1, fallbackTargetIds: (targetIdsByOutput[outputIndex] ?? []).map(Number) });
          }
        }
      }
    }
    const identities = planSlots.map((slot) => ({ slot, ...createRunAutomationOutputIdentity({ runId, slotKey: slot.slotKey }) }));
    const plannedIds = identities.map((identity) => identity.id);
    type DurableExistingOutput = {
      id: string;
      run_id: string;
      scheduled_at: string;
      target_account_ids: unknown;
      status: string;
      group_name: string;
      content_type: SelectableContentType;
      generator: string;
      language: OutputLanguage;
      native_language: OutputLanguage;
      tier: AutomationRow["tier"];
    };
    const { data: existingOutputs, error: existingOutputsError } = plannedIds.length
      ? await supabase.from("social_content_automation_outputs")
        .select("id,run_id,scheduled_at,target_account_ids,status,group_name,content_type,generator,language,native_language,tier")
        .eq("run_id", runId)
        .in("id", plannedIds)
        .returns<DurableExistingOutput[]>()
      : { data: [], error: null };
    if (existingOutputsError) {
      logAutomationRequestFailure("automation_durable_outputs_read_failed", existingOutputsError, { scope: ownerKey, runId, outputCount: plannedIds.length });
      return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    }
    const existingById = new Map((existingOutputs ?? []).map((output) => [output.id, output]));

    const ownOutputIds = new Set(plannedIds);
    const reservations = new Map<number, number[]>();
    for (const schedule of existingSchedules ?? []) {
      if (ownOutputIds.has(schedule.id)) continue;
      const timestamp = new Date(schedule.scheduled_at).getTime();
      if (!Number.isFinite(timestamp) || !Array.isArray(schedule.target_account_ids)) continue;
      for (const accountId of schedule.target_account_ids) {
        if (typeof accountId !== "number") continue;
        reservations.set(accountId, [...(reservations.get(accountId) ?? []), timestamp]);
      }
    }

    const plannedRows: PlannedOutput[] = [];
    for (const { slot, id, generationKey } of identities) {
      const generationDate = generationDateForDayOffset(run.schedule_date, slot.dayOffset);
      const existing = existingById.get(id);
      const targetIds = existing && Array.isArray(existing.target_account_ids)
        ? existing.target_account_ids.map(Number).filter((accountId) => Number.isSafeInteger(accountId) && accountId > 0)
        : slot.fallbackTargetIds;
      const scheduledAt = existing?.scheduled_at ?? createReservedScheduledAt(run.schedule_date, slot.dayOffset, slot.row.scheduleStart, slot.row.scheduleEnd, targetIds, reservations);
      if (!scheduledAt) continue;
      const stableSeed = `${runId}:${generationDate}:${slot.slotKey}`;
      const resolved = existing
        ? { contentType: existing.content_type, generator: existing.generator }
        : resolveContentMode(slot.row, slot.forcedContentType, () => seededRandom(stableSeed));
      const languages = existing
        ? { language: existing.language, nativeLanguage: existing.native_language }
        : resolveOutputLanguages(slot.row, () => seededRandom(`${stableSeed}:language`));
      const tier = existing?.tier ?? slot.row.tier;
      plannedRows.push({
        id,
        generationKey,
        generationDate,
        dayOffset: slot.dayOffset,
        combinationId: slot.row.id,
        generationIndex: slot.generationIndex,
        groupName: existing?.group_name ?? slot.group.name,
        contentType: resolved.contentType,
        generator: resolved.generator,
        language: languages.language,
        nativeLanguage: languages.nativeLanguage,
        tier,
        scheduledAt,
        targetIds,
      });
      if (existing) {
        const timestamp = new Date(existing.scheduled_at).getTime();
        if (Number.isFinite(timestamp)) for (const accountId of targetIds) reservations.set(accountId, [...(reservations.get(accountId) ?? []), timestamp]);
      }
    }
    if (plannedRows.length !== outputsPerDay * parsedRequest.data.horizonDays) {
      logAutomationRequestFailure("automation_preflight_schedule_gap_failed", new Error("automation_preflight_schedule_gap_failed"), { scope: ownerKey, runId, expectedOutputCount: outputsPerDay * parsedRequest.data.horizonDays, plannedOutputCount: plannedRows.length, horizonDays: parsedRequest.data.horizonDays });
      return NextResponse.json({ errorCode: "automation_preflight_schedule_gap_failed" }, { status: 409 });
    }
    const needsBrowserRenderer = plannedRows.some((row) => requiresBrowserRenderer(row.generator));
    const { data: renderer } = await supabase.from("social_content_automation_renderers")
      .select("last_heartbeat_at")
      .eq("owner_key", ownerKey)
      .eq("active", true)
      .is("revoked_at", null)
      .order("last_heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ last_heartbeat_at: string | null }>();
    const rendererOnline = Boolean(renderer?.last_heartbeat_at && Date.now() - new Date(renderer.last_heartbeat_at).getTime() <= 45_000);
    const rows = plannedRows.filter((row) => !existingById.has(row.id)).map((row) => ({
      id: row.id,
      run_id: runId,
      day_offset: row.dayOffset,
      group_name: row.groupName,
      content_type: row.contentType,
      generator: row.generator,
      language: row.language,
      native_language: row.nativeLanguage,
      tier: row.tier,
      scheduled_at: row.scheduledAt,
      target_account_ids: row.targetIds,
      render_plan: createDailyAutomationOutputMetadata({
        generationKey: row.generationKey,
        generationDate: row.generationDate,
        generationIndex: row.generationIndex,
        title: getSocialDownloadTitle(row.nativeLanguage),
        description: null,
      }),
      status: "queued",
    }));
    if (rows.length) {
      const { error: outputsError } = await supabase.from("social_content_automation_outputs").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (outputsError) {
        logAutomationRequestFailure("automation_outputs_create_failed", outputsError, { scope: ownerKey, runId, outputCount: rows.length });
        return NextResponse.json({ errorCode: "automation_outputs_create_failed" }, { status: 503 });
      }
    }
    const { error: runUpdateError } = await supabase.from("social_content_automation_runs")
      .update({
        total_outputs: plannedRows.length,
        preflight_status: "passed",
        preflight_checked_at: new Date().toISOString(),
        preflight_details: { storage: "passed", accounts: selectedAccountIds.length, scheduleGapMinutes: AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS / 60_000, renderer: needsBrowserRenderer ? rendererOnline ? "online" : "offline" : "not_required" },
        ...(allocatedRun.was_created && rows.length ? { status: "queued", completed_at: null } : {}),
      })
      .eq("id", runId)
      .is("generation_stopped_at", null)
      .is("finished_by_user_at", null);
    if (runUpdateError) {
      logAutomationRequestFailure("automation_run_update_failed", runUpdateError, { scope: ownerKey, runId });
      return NextResponse.json({ errorCode: "automation_run_update_failed" }, { status: 503 });
    }
    return NextResponse.json({ run: { ...run, schedule_date: run.schedule_date }, outputCount: plannedRows.length, reusedOutputCount: plannedRows.length - rows.length, runReused: !allocatedRun.was_created }, { status: allocatedRun.was_created ? 201 : 200 });
  } catch (error) {
    logAutomationRequestFailure("automation_run_create_request_failed", error, { scope: ownerKey, horizonDays: parsedRequest.data.horizonDays });
    return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });
  }
}
