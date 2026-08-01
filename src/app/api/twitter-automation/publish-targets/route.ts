import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { isUploadPostConfigured } from "@/features/twitter-automation/upload-post-publishing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SocialMediaRow = { id: number; "Social Media": string | null; "Account Name": string | null; "upload-post profile username": string | null };
export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: accounts, error: accountError } = await supabase
      .from("social_medias")
      .select('id,"Social Media","Account Name","upload-post profile username"')
      .order("id", { ascending: true })
      .returns<SocialMediaRow[]>();
    if (accountError) throw accountError;

    return NextResponse.json({
      accounts: (accounts ?? []).flatMap((account) => {
        const platform = account["Social Media"]?.trim() ?? "";
        const accountName = account["Account Name"]?.trim() ?? "";
        if (!platform || !accountName || platform.toLocaleLowerCase() === "email") return [];
        const status = !isUploadPostConfigured() ? "not_configured" : account["upload-post profile username"]?.trim() ? "ready" : "profile_required";
        return [{ id: account.id, platform, accountName, status }];
      }),
    });
  } catch {
    return NextResponse.json({ accounts: [] }, { status: 503 });
  }
}
