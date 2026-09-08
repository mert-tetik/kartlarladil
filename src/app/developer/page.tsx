import type { Metadata } from "next";
import { DeveloperHub } from "@/features/developer/components/developer-hub";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DeveloperPage() {
  const admin = await requireDeveloperAdmin("/developer");
  return <DeveloperHub email={admin.email} />;
}
