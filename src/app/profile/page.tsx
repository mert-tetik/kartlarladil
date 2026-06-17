import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAuthUser } from "@/features/auth/auth-session";
import { ProfileDashboard } from "@/features/progress/components/profile-dashboard";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.profile.title"),
    description: t("page.profile.description"),
    pathname: "/profile",
    noIndex: true,
  });
}

export default async function ProfilePage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const user = await requireAuthUser("/profile");

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.profile.title")} description={t("page.profile.description")} />
      <div className="mt-8">
        <ProfileDashboard user={user} />
      </div>
    </section>
  );
}
