import { NextRequest, NextResponse } from "next/server";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SocialMediaRow = { id: number; "Social Media": string; "Account Name": string };
type ConnectionRow = { social_media_id: number; status: string };

export async function GET(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: accounts, error: accountError } = await supabase
      .from("social_medias")
      .select('id,"Social Media","Account Name"')
      .order("id", { ascending: true })
      .returns<SocialMediaRow[]>();
    if (accountError) throw accountError;

    const { data: connections } = await supabase
      .from("social_media_connections")
      .select("social_media_id,status")
      .returns<ConnectionRow[]>();
    const statusByAccount = new Map((connections ?? []).map((connection) => [connection.social_media_id, connection.status]));

    return NextResponse.json({
      accounts: (accounts ?? []).flatMap((account) => {
        const platform = account["Social Media"].trim();
        if (!platform || !account["Account Name"].trim() || platform.toLocaleLowerCase() === "email") return [];
        return [{ id: account.id, platform, accountName: account["Account Name"].trim(), status: statusByAccount.get(account.id) ?? "disconnected" }];
      }),
    });
  } catch {
    return NextResponse.json({ accounts: [] }, { status: 503 });
  }
}
