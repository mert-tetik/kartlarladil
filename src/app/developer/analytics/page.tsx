import type { Metadata } from "next";
import { AnalyticsPanel } from "@/features/developer/components/analytics-panel";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getDeveloperAnalytics, getDeveloperDashboardStats } from "@/features/developer/developer-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Analytics | Developer workspace",
  robots: { index: false, follow: false },
};

export default async function DeveloperAnalyticsPage() {
  await requireDeveloperAdmin("/developer/analytics");
  const [stats, analytics] = await Promise.all([
    getDeveloperDashboardStats(),
    getDeveloperAnalytics(),
  ]);
  return <AnalyticsPanel initialStats={stats} analytics={analytics} />;
}
