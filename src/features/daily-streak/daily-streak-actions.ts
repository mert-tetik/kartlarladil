"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DailyStreakSnapshot {
  currentStreak: number;
  today: string;
  loggedDates: string[];
}

export type DailyStreakActionResult =
  | { success: true; snapshot: DailyStreakSnapshot }
  | { success: false; error: "unauthorized" | "database_error" };

export async function syncDailyStreakAction(timeZone = "UTC"): Promise<DailyStreakActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "unauthorized" };
    }

    const { data: streakRow, error: streakError } = await supabase
      .rpc("record_daily_login", { p_timezone: timeZone })
      .maybeSingle<{ current_streak: number; activity_date: string }>();

    if (streakError || !streakRow) {
      return { success: false, error: "database_error" };
    }

    const { data: loginRows, error: loginError } = await supabase
      .from("user_daily_logins")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false });

    if (loginError) {
      return { success: false, error: "database_error" };
    }

    return {
      success: true,
      snapshot: {
        currentStreak: Math.max(1, streakRow.current_streak),
        today: streakRow.activity_date,
        loggedDates: (loginRows ?? []).map((row) => row.activity_date),
      },
    };
  } catch {
    return { success: false, error: "database_error" };
  }
}
