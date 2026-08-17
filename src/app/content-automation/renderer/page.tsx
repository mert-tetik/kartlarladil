import type { Metadata } from "next";
import { AutomationRendererAgent } from "@/features/twitter-automation/components/automation-renderer-agent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AutomationRendererPage() {
  return <AutomationRendererAgent />;
}
