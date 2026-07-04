import { NextResponse } from "next/server";
import { getLeaderboardPayload } from "@/features/leaderboard/leaderboard-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await getLeaderboardPayload(user.id);
  return NextResponse.json(payload);
}
