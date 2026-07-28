import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTOMATION_OWNER_KEY = "social-studio";
const TABLE_NAME = "social_content_automation_state";
const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const PLATFORM_CODES = ["x", "instagram", "facebook", "linkedin", "tiktok"] as const;
const TIER_CODES = ["A1", "A2", "B1", "B2", "C1"] as const;
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);

const automationRowSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["random", "text", "image", "video"]),
  generator: z.string().trim().min(1).max(120),
  language: z.enum(LANGUAGE_CODES),
  nativeLanguage: z.enum(LANGUAGE_CODES),
  tier: z.enum(["random", ...TIER_CODES]),
  platforms: z.array(z.enum(PLATFORM_CODES)).min(1).max(PLATFORM_CODES.length),
  accounts: z.record(z.enum(PLATFORM_CODES), z.array(z.string().trim().min(1).max(120)).min(1).max(20)),
  scheduleStart: timeSchema,
  scheduleEnd: timeSchema,
  saved: z.boolean(),
}).strict().superRefine((row, context) => {
  if (row.scheduleStart >= row.scheduleEnd) {
    context.addIssue({ code: "custom", message: "Schedule start must be before schedule end.", path: ["scheduleEnd"] });
  }

  const platformSet = new Set(row.platforms);
  if (platformSet.size !== row.platforms.length) {
    context.addIssue({ code: "custom", message: "Platforms must be unique.", path: ["platforms"] });
  }

  for (const [platform, accounts] of Object.entries(row.accounts)) {
    if (!platformSet.has(platform as (typeof PLATFORM_CODES)[number])) {
      context.addIssue({ code: "custom", message: "Accounts must belong to a selected platform.", path: ["accounts", platform] });
    }
    if (new Set(accounts).size !== accounts.length) {
      context.addIssue({ code: "custom", message: "Accounts must be unique per platform.", path: ["accounts", platform] });
    }
  }

  for (const platform of row.platforms) {
    if (!row.accounts[platform]?.length) {
      context.addIssue({ code: "custom", message: "Each selected platform needs at least one account.", path: ["accounts", platform] });
    }
  }
});

const automationGroupsSchema = z.object({
  groups: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    tone: z.enum(["emerald", "blue", "amber", "rose"]),
    collapsed: z.boolean(),
    rows: z.array(automationRowSchema).min(1).max(100),
  }).strict()).max(30),
}).strict().superRefine((value, context) => {
  if (new Set(value.groups.map((group) => group.id)).size !== value.groups.length) {
    context.addIssue({ code: "custom", message: "Group ids must be unique.", path: ["groups"] });
  }

  const rowIds = value.groups.flatMap((group) => group.rows.map((row) => row.id));
  if (new Set(rowIds).size !== rowIds.length) {
    context.addIssue({ code: "custom", message: "Row ids must be unique.", path: ["groups"] });
  }
});

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("groups, updated_at")
      .eq("owner_key", AUTOMATION_OWNER_KEY)
      .maybeSingle<{ groups: unknown; updated_at: string }>();
    if (error) return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });

    const parsedGroups = automationGroupsSchema.safeParse({ groups: data?.groups ?? [] });
    return NextResponse.json({
      groups: parsedGroups.success ? parsedGroups.data.groups : [],
      updatedAt: data?.updated_at ?? null,
    });
  } catch {
    return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = automationGroupsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_state" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        owner_key: AUTOMATION_OWNER_KEY,
        groups: parsed.data.groups,
        updated_at: updatedAt,
      }, { onConflict: "owner_key" });
    if (error) return NextResponse.json({ errorCode: "automation_save_failed" }, { status: 503 });

    return NextResponse.json({ groups: parsed.data.groups, updatedAt });
  } catch {
    return NextResponse.json({ errorCode: "automation_save_failed" }, { status: 503 });
  }
}
