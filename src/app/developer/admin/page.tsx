import type { Metadata } from "next";
import { AdminPanel } from "@/features/developer/components/admin-panel";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getDeveloperAuditLogs, getDeveloperDashboardStats, getDeveloperUsers } from "@/features/developer/developer-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DeveloperAdminPage() {
  await requireDeveloperAdmin("/developer/admin");
  const [stats, users, auditLogs] = await Promise.all([getDeveloperDashboardStats(), getDeveloperUsers(), getDeveloperAuditLogs()]);
  return <AdminPanel auditLogs={auditLogs} initialStats={stats} initialUsers={users} />;
}
