import type { Metadata } from "next";
import { LeaderboardPageClient } from "@/features/leaderboard/components/leaderboard-page-client";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("page.leaderboard.title"),
    description: t("page.leaderboard.description"),
    pathname: "/leaderboard",
    noIndex: true,
  });
}

export default async function LeaderboardPage() {
  await requireAuthUser("/leaderboard");
  return <LeaderboardPageClient />;
}
