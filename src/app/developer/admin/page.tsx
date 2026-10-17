import type { Metadata } from "next";
import { AdminPanel } from "@/features/developer/components/admin-panel";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getDeveloperAuditLogs, getDeveloperUsers } from "@/features/developer/developer-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DeveloperAdminPage() {
  await requireDeveloperAdmin("/developer/admin");
  const [users, auditLogs] = await Promise.all([getDeveloperUsers(), getDeveloperAuditLogs()]);
  return <AdminPanel auditLogs={auditLogs} initialUsers={users} />;
}
