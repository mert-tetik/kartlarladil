"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
      if (streakError?.code === "42702") {
        return syncLegacyDailyStreak(user.id, timeZone);
      }

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

async function syncLegacyDailyStreak(userId: string, timeZone: string): Promise<DailyStreakActionResult> {
  const today = getDateKeyInTimeZone(timeZone);

  if (!today) {
    return { success: false, error: "database_error" };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error: insertError } = await admin.from("user_daily_logins").upsert(
      {
        user_id: userId,
        activity_date: today,
      },
      {
        onConflict: "user_id,activity_date",
        ignoreDuplicates: true,
      },
    );

    if (insertError) {
      return { success: false, error: "database_error" };
    }

    const { data: loginRows, error: loginError } = await admin
      .from("user_daily_logins")
      .select("activity_date")
      .eq("user_id", userId)
      .order("activity_date", { ascending: false });

    if (loginError) {
      return { success: false, error: "database_error" };
    }

    const loggedDates = (loginRows ?? []).map((row) => row.activity_date);

    return {
      success: true,
      snapshot: {
        currentStreak: calculateCurrentStreak(today, loggedDates),
        today,
        loggedDates,
      },
    };
  } catch {
    return { success: false, error: "database_error" };
  }
}

function getDateKeyInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    if (!values.year || !values.month || !values.day) {
      return null;
    }

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return null;
  }
}

function calculateCurrentStreak(today: string, loggedDates: string[]) {
  const loggedDateSet = new Set(loggedDates);
  const cursor = new Date(`${today}T12:00:00Z`);
  let streak = 0;

  while (loggedDateSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return Math.max(1, streak);
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
