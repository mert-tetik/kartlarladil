import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTOMATION_GROUP_ICON_IDS } from "@/features/twitter-automation/automation-group-icons";
import { AUTOMATION_SUPER_GROUP_ICON_IDS } from "@/features/twitter-automation/automation-super-groups";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE_NAME = "social_content_automation_state";
const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const languageSelectionSchema = z.enum(["random", ...LANGUAGE_CODES]);
const TIER_CODES = ["A1", "A2", "B1", "B2", "C1"] as const;
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
const platformSchema = z.string().trim().min(1).max(80);
const accountIdSchema = z.string().trim().min(1).max(120);
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

type SocialMediaDatabaseRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type SocialMediaAccount = {
  id: string;
  platform: string;
  platformLabel: string;
  accountName: string;
};

function toPlatformKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, "-");
}

async function loadSocialMediaAccounts() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    // Deliberately do not select description: it can contain credentials/context
    // that must never leave this server-only integration endpoint.
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .order("id", { ascending: true })
    .returns<SocialMediaDatabaseRow[]>();

  if (error) return { accounts: null, error };

  const accounts = (data ?? []).flatMap((row): SocialMediaAccount[] => {
    const platformLabel = row["Social Media"]?.trim();
    const accountName = row["Account Name"]?.trim();
    if (!platformLabel || !accountName || platformLabel.toLocaleLowerCase() === "email") return [];

    return [{
      id: String(row.id),
      platform: toPlatformKey(platformLabel),
      platformLabel,
      accountName,
    }];
  });

  return { accounts, error: null };
}

const automationRowSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["random", "text", "image", "video"]),
  generator: z.string().trim().min(1).max(120),
  contentTypes: z.array(selectableContentTypeSchema).min(1).max(3).optional(),
  generators: generatorModesSchema.optional(),
  randomIncludes: randomIncludesSchema.optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  language: languageSelectionSchema,
  nativeLanguage: languageSelectionSchema,
  tier: z.enum(["random", ...TIER_CODES]),
  platforms: z.array(platformSchema).min(1).max(20),
  accounts: z.record(platformSchema, z.array(accountIdSchema).min(1).max(20)),
  scheduleStart: timeSchema,
  scheduleEnd: timeSchema,
  saved: z.boolean(),
}).strict().superRefine((row, context) => {
  if (row.scheduleStart >= row.scheduleEnd) {
    context.addIssue({ code: "custom", message: "Schedule start must be before schedule end.", path: ["scheduleEnd"] });
  }

  if (row.contentTypes) {
    if (new Set(row.contentTypes).size !== row.contentTypes.length) {
      context.addIssue({ code: "custom", message: "Content types must be unique.", path: ["contentTypes"] });
    }
    for (const contentType of row.contentTypes) {
      if (!row.generators?.[contentType]) {
        context.addIssue({ code: "custom", message: "Each selected content type needs a generator.", path: ["generators", contentType] });
      }
    }
  }

  const platformSet = new Set(row.platforms);
  if (platformSet.size !== row.platforms.length) {
    context.addIssue({ code: "custom", message: "Platforms must be unique.", path: ["platforms"] });
  }

  for (const [platform, accounts] of Object.entries(row.accounts)) {
    if (!platformSet.has(platform)) {
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
    color: z.string().regex(/^#[\da-f]{6}$/iu).optional(),
    icon: z.enum(AUTOMATION_GROUP_ICON_IDS).optional(),
    superGroupId: z.string().uuid().optional(),
    collapsed: z.boolean(),
    rows: z.array(automationRowSchema).min(1).max(100),
  }).strict()).max(30),
  superGroups: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    icon: z.enum(AUTOMATION_SUPER_GROUP_ICON_IDS),
  }).strict()).max(30).default([]),
}).strict().superRefine((value, context) => {
  if (new Set(value.groups.map((group) => group.id)).size !== value.groups.length) {
    context.addIssue({ code: "custom", message: "Group ids must be unique.", path: ["groups"] });
  }

  const rowIds = value.groups.flatMap((group) => group.rows.map((row) => row.id));
  if (new Set(rowIds).size !== rowIds.length) {
    context.addIssue({ code: "custom", message: "Row ids must be unique.", path: ["groups"] });
  }

  const superGroupIds = new Set(value.superGroups.map((superGroup) => superGroup.id));
  if (superGroupIds.size !== value.superGroups.length) {
    context.addIssue({ code: "custom", message: "Upper group ids must be unique.", path: ["superGroups"] });
  }
  for (const group of value.groups) {
    if (group.superGroupId && !superGroupIds.has(group.superGroupId)) {
      context.addIssue({ code: "custom", message: "Each group must reference an existing upper group.", path: ["groups"] });
    }
  }
});

function parseStoredAutomationState(value: unknown) {
  return automationGroupsSchema.safeParse(Array.isArray(value) ? { groups: value, superGroups: [] } : value);
}

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

function hasValidSocialSelections(groups: z.infer<typeof automationGroupsSchema>["groups"], accounts: SocialMediaAccount[]) {
  const accountIdsByPlatform = new Map<string, Set<string>>();
  for (const account of accounts) {
    const ids = accountIdsByPlatform.get(account.platform) ?? new Set<string>();
    ids.add(account.id);
    accountIdsByPlatform.set(account.platform, ids);
  }

  return groups.every((group) => group.rows.every((row) => row.platforms.every((platform) => {
    const allowedAccountIds = accountIdsByPlatform.get(platform);
    if (!allowedAccountIds) return false;
    return row.accounts[platform]?.every((accountId) => allowedAccountIds.has(accountId)) ?? false;
  })));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data, error }, socialMedia] = await Promise.all([
      supabase
      .from(TABLE_NAME)
      .select("groups, updated_at")
      .eq("owner_key", ownerKey)
      .maybeSingle<{ groups: unknown; updated_at: string }>(),
      loadSocialMediaAccounts(),
    ]);
    if (error || socialMedia.error || !socialMedia.accounts) {
      return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
    }

    const parsedGroups = parseStoredAutomationState(data?.groups ?? []);
    return NextResponse.json({
      groups: parsedGroups.success ? parsedGroups.data.groups : [],
      superGroups: parsedGroups.success ? parsedGroups.data.superGroups : [],
      socialAccounts: socialMedia.accounts,
      updatedAt: data?.updated_at ?? null,
    });
  } catch {
    return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));

  const parsed = automationGroupsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_state" }, { status: 400 });

  try {
    const socialMedia = await loadSocialMediaAccounts();
    if (socialMedia.error || !socialMedia.accounts) {
      return NextResponse.json({ errorCode: "automation_storage_unavailable" }, { status: 503 });
    }
    if (!hasValidSocialSelections(parsed.data.groups, socialMedia.accounts)) {
      return NextResponse.json({ errorCode: "invalid_social_media_selection" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        owner_key: ownerKey,
        groups: parsed.data,
        updated_at: updatedAt,
      }, { onConflict: "owner_key" });
    if (error) return NextResponse.json({ errorCode: "automation_save_failed" }, { status: 503 });

    return NextResponse.json({ groups: parsed.data.groups, superGroups: parsed.data.superGroups, updatedAt });
  } catch {
    return NextResponse.json({ errorCode: "automation_save_failed" }, { status: 503 });
  }
}
