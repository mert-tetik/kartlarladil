import type { Metadata } from "next";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getSocialAnalyticsData } from "@/features/developer/social-analytics-data";
import { SocialAnalyticsPanel } from "@/features/developer/components/social-analytics-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Social medias | Developer workspace",
  robots: { index: false, follow: false },
};

export default async function SocialAnalyticsPage() {
  await requireDeveloperAdmin("/developer/social-analytics");
  const data = await getSocialAnalyticsData();
  return <SocialAnalyticsPanel initialData={data} />;
}
