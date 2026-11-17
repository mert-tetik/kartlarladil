import { NextRequest, NextResponse } from "next/server";
import { scanAuthProfileHealth } from "@/features/auth/profile-health-service";
import { logProfileEvent } from "@/features/auth/profile-observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "forbidden" }, { status: 403 });

  try {
    const report = await scanAuthProfileHealth(createSupabaseAdminClient());
    const logFields = {
      authUsers: report.authUsers,
      profiles: report.profiles,
      missingProfiles: report.missingProfiles,
      actionableMissingProfiles: report.actionableMissingProfiles,
      pendingWithinGracePeriod: report.pendingWithinGracePeriod,
      missingCreatedWithin24Hours: report.missingCreatedWithin24Hours,
      missingCreatedWithin7Days: report.missingCreatedWithin7Days,
      sampleFingerprints: report.sampleFingerprints.join(","),
    };

    if (report.actionableMissingProfiles > 0) {
      logProfileEvent("error", "profile_health_scan_found_missing_profiles", logFields);
      return NextResponse.json({ healthy: false, ...report }, { status: 503 });
    }

    if (report.pendingWithinGracePeriod > 0) {
      logProfileEvent("warn", "profile_health_scan_recent_profiles_pending", logFields);
      return NextResponse.json({ healthy: true, ...report });
    }

    logProfileEvent("info", "profile_health_scan_clean", logFields);
    return NextResponse.json({ healthy: true, ...report });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "unexpected_error";
    logProfileEvent("error", "profile_health_scan_failed", { errorCode });
    return NextResponse.json({ errorCode: "profile_health_scan_failed" }, { status: 503 });
  }
}
