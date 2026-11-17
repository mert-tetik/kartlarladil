import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/features/auth/auth-session";
import { logProfileEvent, getProfileUserFingerprint } from "@/features/auth/profile-observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return NextResponse.json({ available: false, errorCode: "session_required" }, { status: 401 });
  }

  const userFingerprint = getProfileUserFingerprint(session.user.id);

  try {
    const result = await ensureUserProfile(supabase, session.user, {
      source: "client_session_recovery",
    });

    if (!result.available) {
      return NextResponse.json(
        { available: false, errorCode: result.errorCode ?? "profile_unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      available: true,
      created: result.created,
      profile: result.profile,
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "unexpected_error";
    logProfileEvent("error", "profile_recovery_route_failed", {
      source: "client_session_recovery",
      userFingerprint,
      errorCode,
    });
    return NextResponse.json({ available: false, errorCode: "profile_unavailable" }, { status: 503 });
  }
}
