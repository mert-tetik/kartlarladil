import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { RANDOM_GENERATOR, resolveGeneratorSelection } from "@/features/twitter-automation/automation-randomization";
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

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
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
  const includeMedia = request.nextUrl.searchParams.get("includeMedia") === "1";
  if (runId && !z.string().uuid().safeParse(runId).success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,created_at,updated_at,generated_at,scheduled_at_upload_post,run:social_content_automation_runs!inner(id,horizon_days,status,created_at)")
      .eq("run.owner_key", ownerKey)
      .order("scheduled_at", { ascending: true })
      .limit(300);
    if (runId) query = query.eq("run_id", runId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
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
    return NextResponse.json({ outputs });
  } catch {
    return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
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

    const outputsPerDay = sourceRows.reduce((total, item) => total + item.row.quantity, 0);
    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .insert({ owner_key: ownerKey, horizon_days: parsedRequest.data.horizonDays, status: "queued", total_outputs: outputsPerDay * parsedRequest.data.horizonDays })
      .select("id,horizon_days,created_at")
      .single();
    if (runError || !run) return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });

    const rows = Array.from({ length: parsedRequest.data.horizonDays }, (_, index) => index + 1).flatMap((dayOffset) => sourceRows.flatMap(({ group, row, targetIds }) => Array.from({ length: row.quantity }, () => {
      const { contentType, generator } = resolveContentMode(row);
      const { language, nativeLanguage } = resolveOutputLanguages(row);
      return {
        run_id: run.id,
        day_offset: dayOffset,
        group_name: group.name,
        content_type: contentType,
        generator,
        language,
        native_language: nativeLanguage,
        tier: row.tier,
        scheduled_at: createScheduledAt(dayOffset, row.scheduleStart, row.scheduleEnd),
        target_account_ids: targetIds,
        status: "queued",
      };
    })));
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
