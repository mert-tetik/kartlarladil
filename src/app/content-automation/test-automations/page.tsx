import type { Metadata } from "next";
import { SocialContentStudioPage } from "@/features/twitter-automation/components/twitter-automation-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TestContentAutomationTableRoute() {
  return <SocialContentStudioPage view="test-automations" />;
}
