import type { Metadata } from "next";
import { TwitterAutomationPage } from "@/features/twitter-automation/components/twitter-automation-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TwitterAutomationRoute() {
  return <TwitterAutomationPage />;
}
