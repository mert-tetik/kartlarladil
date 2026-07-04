import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

  if (enabled === null) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      leaderboard_visible: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enabled });
}
