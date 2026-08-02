import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_KEY = "social-studio";
const STATE_TABLE = "social_content_automation_state";
const AUTOMATION_BUCKET = "social-studio-automation";
const languageSchema = z.enum(["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
const selectableContentTypeSchema = z.enum(["text", "image", "video"]);
const generatorModesSchema = z.object({
  text: z.string().trim().min(1).max(120).optional(),
  image: z.string().trim().min(1).max(120).optional(),
  video: z.string().trim().min(1).max(120).optional(),
}).strict();
const rowSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["random", "text", "image", "video"]),
  generator: z.string().trim().min(1).max(120),
  contentTypes: z.array(selectableContentTypeSchema).min(1).max(3).optional(),
  generators: generatorModesSchema.optional(),
  language: languageSchema,
  nativeLanguage: languageSchema,
  tier: z.enum(["random", "A1", "A2", "B1", "B2", "C1"]),
  accounts: z.record(z.string(), z.array(z.string().regex(/^\d+$/u)).min(1)).refine((accounts) => Object.values(accounts).flat().length > 0),
  scheduleStart: timeSchema,
  scheduleEnd: timeSchema,
}).passthrough().refine((row) => row.scheduleStart < row.scheduleEnd, { path: ["scheduleEnd"], message: "Schedule end must be later than start." });
const groupsSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  rows: z.array(rowSchema).min(1).max(100),
}).passthrough()).min(1).max(30);
const requestSchema = z.object({ horizonDays: z.union([z.literal(1), z.literal(3), z.literal(7)]) }).strict();

type AutomationRow = z.infer<typeof rowSchema>;
type AutomationGroup = z.infer<typeof groupsSchema>[number];
type SelectableContentType = z.infer<typeof selectableContentTypeSchema>;

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
  const generator = row.generators?.[contentType]
    ?? (row.contentType === contentType ? row.generator : contentType === "text" ? "random-text" : contentType === "image" ? "random-ai-image" : "random-video");

  return { contentType, generator };
}

async function toMediaUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("https://")) return path;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).createSignedUrl(path, 60 * 60);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const runId = request.nextUrl.searchParams.get("runId");
  if (runId && !z.string().uuid().safeParse(runId).success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_type,provider_task_id,upload_post_jobs,error_code,created_at,updated_at,generated_at,scheduled_at_upload_post,run:social_content_automation_runs!inner(id,horizon_days,status,created_at)")
      .eq("run.owner_key", OWNER_KEY)
      .order("scheduled_at", { ascending: true })
      .limit(300);
    if (runId) query = query.eq("run_id", runId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    const outputs = await Promise.all((data ?? []).map(async (output) => ({ ...output, mediaUrl: await toMediaUrl(typeof output.media_path === "string" ? output.media_path : null) })));
    return NextResponse.json({ outputs });
  } catch {
    return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ errorCode: "invalid_automation_horizon" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: state, error: stateError } = await supabase.from(STATE_TABLE).select("groups").eq("owner_key", OWNER_KEY).maybeSingle<{ groups: unknown }>();
    if (stateError) return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
    const parsedGroups = groupsSchema.safeParse(state?.groups);
    if (!parsedGroups.success) return NextResponse.json({ errorCode: "invalid_automation_state" }, { status: 409 });

    const sourceRows = parsedGroups.data.flatMap((group) => group.rows.map((row) => ({ group, row, targetIds: targetAccountIds(row) }))).filter((item) => item.targetIds.length > 0);
    if (!sourceRows.length) return NextResponse.json({ errorCode: "automation_targets_missing" }, { status: 409 });

    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .insert({ owner_key: OWNER_KEY, horizon_days: parsedRequest.data.horizonDays, status: "queued", total_outputs: sourceRows.length * parsedRequest.data.horizonDays })
      .select("id,horizon_days,created_at")
      .single();
    if (runError || !run) return NextResponse.json({ errorCode: "automation_run_create_failed" }, { status: 503 });

    const rows = Array.from({ length: parsedRequest.data.horizonDays }, (_, index) => index + 1).flatMap((dayOffset) => sourceRows.map(({ group, row, targetIds }) => {
      const { contentType, generator } = resolveContentMode(row);
      return {
        run_id: run.id,
        day_offset: dayOffset,
        group_name: group.name,
        content_type: contentType,
        generator,
        language: row.language,
        native_language: row.nativeLanguage,
        tier: row.tier,
        scheduled_at: createScheduledAt(dayOffset, row.scheduleStart, row.scheduleEnd),
        target_account_ids: targetIds,
        status: "queued",
      };
    }));
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
