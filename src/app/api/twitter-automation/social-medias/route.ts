import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE_NAME = "social_medias";
const accountFieldsSchema = z.object({
  socialMedia: z.string().trim().min(1).max(120),
  accountName: z.string().trim().min(1).max(160),
  uploadPostProfileUsername: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).nullable(),
}).strict();

const createSchema = accountFieldsSchema;
const updateSchema = accountFieldsSchema.extend({
  id: z.number().int().positive(),
}).strict();
const deleteSchema = z.object({
  id: z.coerce.number().int().positive(),
});

type SocialMediaRow = {
  id: number;
  "Social Media": string | null;
  "Account Name": string | null;
  "upload-post profile username": string | null;
  description: string | null;
};

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

function toDatabaseRow(value: z.infer<typeof accountFieldsSchema>) {
  return {
    "Social Media": value.socialMedia,
    "Account Name": value.accountName,
    "upload-post profile username": value.uploadPostProfileUsername,
    description: value.description || null,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id,"Social Media","Account Name","upload-post profile username",description')
      .order("id", { ascending: true })
      .returns<SocialMediaRow[]>();
    if (error) return NextResponse.json({ errorCode: "social_medias_unavailable" }, { status: 503 });

    return NextResponse.json({ accounts: data ?? [] });
  } catch {
    return NextResponse.json({ errorCode: "social_medias_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_social_media" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(toDatabaseRow(parsed.data))
      .select('id,"Social Media","Account Name","upload-post profile username",description')
      .single<SocialMediaRow>();
    if (error || !data) return NextResponse.json({ errorCode: "social_media_create_failed" }, { status: 503 });

    return NextResponse.json({ account: data }, { status: 201 });
  } catch {
    return NextResponse.json({ errorCode: "social_media_create_failed" }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_social_media" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(toDatabaseRow(parsed.data))
      .eq("id", parsed.data.id)
      .select('id,"Social Media","Account Name","upload-post profile username",description')
      .maybeSingle<SocialMediaRow>();
    if (error) return NextResponse.json({ errorCode: "social_media_update_failed" }, { status: 503 });
    if (!data) return NextResponse.json({ errorCode: "social_media_not_found" }, { status: 404 });

    return NextResponse.json({ account: data });
  } catch {
    return NextResponse.json({ errorCode: "social_media_update_failed" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse({ id: request.nextUrl.searchParams.get("id") });
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_social_media_id" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", parsed.data.id)
      .select("id")
      .maybeSingle<{ id: number }>();
    if (error) {
      const errorCode = error.code === "23503" ? "social_media_in_use" : "social_media_delete_failed";
      return NextResponse.json({ errorCode }, { status: errorCode === "social_media_in_use" ? 409 : 503 });
    }
    if (!data) return NextResponse.json({ errorCode: "social_media_not_found" }, { status: 404 });

    return NextResponse.json({ deletedId: data.id });
  } catch {
    return NextResponse.json({ errorCode: "social_media_delete_failed" }, { status: 503 });
  }
}
