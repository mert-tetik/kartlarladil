import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioAutomationSession, hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { RANDOM_GENERATOR, resolveGeneratorSelection } from "@/features/twitter-automation/automation-randomization";
import { AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS } from "@/features/twitter-automation/automation-resilience";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_TABLE = "social_content_automation_state";
const AUTOMATION_BUCKET = "social-studio-automation";
const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
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
const rowSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["random", "text", "image", "video"]),
  generator: z.string().trim().min(1).max(120),
  contentTypes: z.array(selectableContentTypeSchema).min(1).max(3).optional(),
  generators: generatorModesSchema.optional(),
  randomIncludes: randomIncludesSchema.optional(),
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
  scope: z.enum(["production", "test"]).optional(),
}).strict();

type AutomationRow = z.infer<typeof rowSchema>;
type SelectableContentType = z.infer<typeof selectableContentTypeSchema>;
type OutputLanguage = (typeof LANGUAGE_CODES)[number];
type PlannedOutput = {
  dayOffset: number;
  groupName: string;
  contentType: SelectableContentType;
  generator: string;
  language: OutputLanguage;
  nativeLanguage: OutputLanguage;
  tier: AutomationRow["tier"];
  scheduledAt: string;
  targetIds: number[];
};

function isAuthorized(request: NextRequest) {
  return hasSocialStudioAutomationSession(request.headers.get("cookie"));
}

function istanbulDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

function createScheduledAt(dayOffset: number, start: string, end: string) {
  const today = istanbulDateParts(new Date());
  const target = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const minute = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes + 1));
  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  const day = String(target.getUTCDate()).padStart(2, "0");
  const hour = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minutes}:00+03:00`;
}

function targetAccountIds(row: AutomationRow) {
  return [...new Set(Object.values(row.accounts).flat().map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
}

function createReservedScheduledAt(dayOffset: number, start: string, end: string, accountIds: number[], reservations: Map<number, number[]>) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = createScheduledAt(dayOffset, start, end);
    const candidateTime = new Date(candidate).getTime();
    if (!Number.isFinite(candidateTime)) continue;
    const hasConflict = accountIds.some((accountId) => (reservations.get(accountId) ?? []).some((reservedAt) => Math.abs(reservedAt - candidateTime) < AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS));
    if (hasConflict) continue;
    for (const accountId of accountIds) reservations.set(accountId, [...(reservations.get(accountId) ?? []), candidateTime]);
    return candidate;
  }
  return null;
}

function pickLanguage(candidates: readonly OutputLanguage[] = LANGUAGE_CODES) {
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function resolveOutputLanguages(row: AutomationRow) {
  const language = row.language === "random" ? pickLanguage() : row.language;
  if (row.nativeLanguage !== "random") return { language, nativeLanguage: row.nativeLanguage };
  return { language, nativeLanguage: pickLanguage(LANGUAGE_CODES.filter((candidate) => candidate !== language)) };
}

function resolveContentMode(row: AutomationRow) {
  const selectedTypes: SelectableContentType[] = row.contentTypes?.length
    ? [...new Set(row.contentTypes)]
    : row.contentType === "image"
      ? ["image"]
      : row.contentType === "text"
        ? ["text"]
        : row.contentType === "video"
          ? ["video"]
          : ["text", "image", "video"];
  const contentType = selectedTypes[Math.floor(Math.random() * selectedTypes.length)]!;
  const generatorMode = row.generators?.[contentType]
    ?? (row.contentType === contentType ? row.generator : RANDOM_GENERATOR);
  const generator = resolveGeneratorSelection(contentType, generatorMode, row.randomIncludes?.[contentType]);

  return { contentType, generator };
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
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));
  const runId = request.nextUrl.searchParams.get("runId");
  const activeOnly = request.nextUrl.searchParams.get("active") === "1";
  const includeMedia = request.nextUrl.searchParams.get("includeMedia") === "1";
  if (runId && !z.string().uuid().safeParse(runId).success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const outputLimit = runId ? 1_000 : 300;
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,attempt_count,next_attempt_at,last_error_class,quality_status,quality_error,quality_checked_at,lease_renderer_id,lease_expires_at,renderer_heartbeat_at,render_plan,generation_attempt_started_at,duration_recorded_at,created_at,updated_at,generated_at,scheduled_at_upload_post,run:social_content_automation_runs!inner(id,horizon_days,status,created_at,preflight_status,preflight_details,auto_schedule_on_success,auto_schedule_error)")
      .eq("run.owner_key", ownerKey)
      .order("scheduled_at", { ascending: true })
      .limit(outputLimit);
    if (runId) query = query.eq("run_id", runId);
    if (activeOnly) query = query.in("run.status", ["queued", "processing", "ready_to_schedule"]);
    const { data, error } = await query;
    if (error) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    const durationProfiles = runId
      ? await supabase
        .from("social_content_automation_mode_durations")
        .select("generator,average_duration_ms")
        .then(({ data, error: durationError }) => durationError ? {} : Object.fromEntries((data ?? [])
          .filter((profile): profile is { generator: string; average_duration_ms: number } => typeof profile.generator === "string" && Number.isFinite(profile.average_duration_ms) && profile.average_duration_ms > 0)
          .map((profile) => [profile.generator, profile.average_duration_ms])))
      : {};
    const outputs = await Promise.all((data ?? []).map(async (output) => {
      const needsBrowserVideoSource = output.status === "awaiting_browser_video" && typeof output.media_path === "string";
      if (!includeMedia && !needsBrowserVideoSource) return { ...output, mediaUrl: null, mediaUrls: [] };
      const paths = mediaPaths(output.media_paths);
      const mediaUrls = await Promise.all(paths.map((path) => toMediaUrl(path)));
      return {
        ...output,
        mediaUrl: await toMediaUrl(typeof output.media_path === "string" ? output.media_path : null),
        mediaUrls: mediaUrls.filter((url): url is string => Boolean(url)),
      };
    }));
    return NextResponse.json({ outputs, durationProfiles });
  } catch {
    return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ errorCode: "invalid_automation_horizon" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsedRequest.data.scope));

  try {
    const supabase = createSupabaseAdminClient();
    const { data: state, error: stateError } = await supabase.from(STATE_TABLE).select("groups").eq("owner_key", ownerKey).maybeSingle<{ groups: unknown }>();
    if (stateError) return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
    const parsedState = storedAutomationStateSchema.safeParse(state?.groups);
    if (!parsedState.success) return NextResponse.json({ errorCode: "invalid_automation_state" }, { status: 409 });
    const parsedGroups = Array.isArray(parsedState.data) ? parsedState.data : parsedState.data.groups;
    const hiddenSuperGroupIds = new Set(Array.isArray(parsedState.data) ? [] : parsedState.data.superGroups.filter((superGroup) => superGroup.hidden).map((superGroup) => superGroup.id));

    const sourceRows = parsedGroups.filter((group) => !group.hidden && (!group.superGroupId || !hiddenSuperGroupIds.has(group.superGroupId))).flatMap((group) => group.rows.map((row) => ({ group, row, targetIds: targetAccountIds(row) }))).filter((item) => item.targetIds.length > 0);
    if (!sourceRows.length) return NextResponse.json({ errorCode: "automation_targets_missing" }, { status: 409 });

    const selectedAccountIds = [...new Set(sourceRows.flatMap((item) => item.targetIds))];
    const [{ data: accountRows, error: accountError }, { error: storageError }] = await Promise.all([
      supabase.from("social_medias").select("id").in("id", selectedAccountIds),
      supabase.storage.from(AUTOMATION_BUCKET).list("", { limit: 1 }),
    ]);
    if (accountError || (accountRows?.length ?? 0) !== selectedAccountIds.length) return NextResponse.json({ errorCode: "automation_preflight_accounts_failed" }, { status: 409 });
    if (storageError) return NextResponse.json({ errorCode: "automation_preflight_storage_failed" }, { status: 503 });

    const { data: existingSchedules, error: scheduleError } = await supabase
      .from("social_content_automation_outputs")
      .select("scheduled_at,target_account_ids,run:social_content_automation_runs!inner(owner_key)")
      .eq("run.owner_key", ownerKey)
      .gte("scheduled_at", new Date().toISOString())
      .in("status", ["queued", "processing", "generating_video", "awaiting_browser_image", "awaiting_browser_video", "ready_to_schedule", "scheduled"])
      .limit(2_000);
    if (scheduleError) return NextResponse.json({ errorCode: "automation_preflight_schedule_failed" }, { status: 503 });
    const reservations = new Map<number, number[]>();
    for (const schedule of existingSchedules ?? []) {
      const timestamp = new Date(schedule.scheduled_at).getTime();
      if (!Number.isFinite(timestamp) || !Array.isArray(schedule.target_account_ids)) continue;
      for (const accountId of schedule.target_account_ids) {
        if (typeof accountId !== "number") continue;
        reservations.set(accountId, [...(reservations.get(accountId) ?? []), timestamp]);
      }
    }

    const outputsPerDay = sourceRows.reduce((total, item) => total + item.row.quantity, 0);
    const plannedRows: PlannedOutput[] = Array.from({ length: parsedRequest.data.horizonDays }, (_, index) => index + 1).flatMap((dayOffset) => sourceRows.flatMap(({ group, row, targetIds }) => Array.from({ length: row.quantity }, () => {
      const scheduledAt = createReservedScheduledAt(dayOffset, row.scheduleStart, row.scheduleEnd, targetIds, reservations);
      if (!scheduledAt) return null;
      const { contentType, generator } = resolveContentMode(row);
      const { language, nativeLanguage } = resolveOutputLanguages(row);
      return { dayOffset, groupName: group.name, contentType, generator, language, nativeLanguage, tier: row.tier, scheduledAt, targetIds };
    }))).filter((row): row is PlannedOutput => row !== null);
    if (plannedRows.length !== outputsPerDay * parsedRequest.data.horizonDays) {
      return NextResponse.json({ errorCode: "automation_preflight_schedule_gap_failed" }, { status: 409 });
    }
    const needsBrowserRenderer = plannedRows.some((row) => row.generator.startsWith("music-") || ["word-of-the-day", "word-of-the-day-poster", "vocabulary-carousel", "tier-progression-carousel", "self-mini-quiz", "self-false-friends", "self-daily-challenge", "self-vocabulary-progression", "self-example-sentences", "confused-words-video", "marketing-dialogue-video", "learning-dialogue-video", "tier-progression-video", "vocabulary-quiz-video", "sentence-check-video", "sentence-translation-video"].includes(row.generator));
    const { data: renderer } = await supabase
      .from("social_content_automation_renderers")
      .select("last_heartbeat_at")
      .eq("owner_key", ownerKey)
      .eq("active", true)
      .is("revoked_at", null)
      .order("last_heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ last_heartbeat_at: string | null }>();
    const rendererOnline = Boolean(renderer?.last_heartbeat_at && Date.now() - new Date(renderer.last_heartbeat_at).getTime() <= 45_000);
    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .insert({ owner_key: ownerKey, horizon_days: parsedRequest.data.horizonDays, status: "queued", total_outputs: plannedRows.length, preflight_status: "passed", preflight_checked_at: new Date().toISOString(), preflight_details: { storage: "passed", accounts: selectedAccountIds.length, scheduleGapMinutes: AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS / 60_000, renderer: needsBrowserRenderer ? rendererOnline ? "online" : "offline" : "not_required" } })
      .select("id,horizon_days,created_at")
      .single();
    if (runError || !run) return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });

    const rows = plannedRows.map((row) => {
      return {
        run_id: run.id,
        day_offset: row.dayOffset,
        group_name: row.groupName,
        content_type: row.contentType,
        generator: row.generator,
        language: row.language,
        native_language: row.nativeLanguage,
        tier: row.tier,
        scheduled_at: row.scheduledAt,
        target_account_ids: row.targetIds,
        status: "queued",
      };
    });
    const { error: outputsError } = await supabase.from("social_content_automation_outputs").insert(rows);
    if (outputsError) {
      await supabase.from("social_content_automation_runs").delete().eq("id", run.id);
      return NextResponse.json({ errorCode: "automation_outputs_create_failed" }, { status: 503 });
    }
    return NextResponse.json({ run, outputCount: rows.length }, { status: 201 });
  } catch {
    return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });
  }
}
