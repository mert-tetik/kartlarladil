import type { Metadata } from "next";
import { SocialContentStudioPage } from "@/features/twitter-automation/components/twitter-automation-page";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ContentAutomationRoute() {
  await requireDeveloperAdmin("/content-automation");
  return <SocialContentStudioPage />;
}
