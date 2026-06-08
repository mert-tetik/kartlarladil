import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAuthUser } from "@/features/auth/auth-session";
import { ProfileDashboard } from "@/features/progress/components/profile-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil | Kartlarla Dil",
};

export default async function ProfilePage() {
  const user = await requireAuthUser("/profil");

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Profil"
        description="Puanını, rank ilerlemeni, öğrenilen kartlarını ve kelime havuzunu tek ekranda takip et."
      />
      <div className="mt-8">
        <ProfileDashboard user={user} />
      </div>
    </section>
  );
}
