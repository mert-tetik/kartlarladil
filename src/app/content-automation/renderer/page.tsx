import type { Metadata } from "next";
import { AutomationRendererAgent } from "@/features/twitter-automation/components/automation-renderer-agent";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getAutomationRendererSession } from "@/features/twitter-automation/social-studio-auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AutomationRendererPage() {
  const cookieHeader = (await headers()).get("cookie");
  if (!getAutomationRendererSession(cookieHeader)) {
    await requireDeveloperAdmin("/content-automation/renderer");
  }

  return <AutomationRendererAgent />;
}
