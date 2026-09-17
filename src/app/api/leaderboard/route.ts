import { NextResponse } from "next/server";
import { getLeaderboardPayload } from "@/features/leaderboard/leaderboard-service";
import { parseLeaderboardMode } from "@/features/leaderboard/leaderboard-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mode = parseLeaderboardMode(new URL(request.url).searchParams.get("mode"));
  const payload = await getLeaderboardPayload(user.id, mode);
  return NextResponse.json(payload);
}
