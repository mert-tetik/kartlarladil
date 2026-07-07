import type { Metadata } from "next";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getServerLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/dictionaries";
import { listUserMissionsAction } from "@/features/missions/mission-actions";
import { MissionsList } from "@/features/missions/components/missions-list";
import { AppNavigation } from "@/components/app-navigation";
import type { MissionProgressSnapshot } from "@/features/missions/mission-types";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return {
    title: `${t("missions.title")} | FoxiesDeck`,
  };
}

export default async function MissionsPage() {
  const user = await requireAuthUser("/missions");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const snapshot: MissionProgressSnapshot = {
    totalCards: 0,
    learnedCards: 0,
    bestMemoryLevel: 0,
    bestWordChallengeLevel: 0,
    bestWordMatchLevel: 0,
    practicedCharacterIds: new Set(),
  };

  const missionsResult = await listUserMissionsAction(snapshot);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <AppNavigation user={user} />
      <div className="flex flex-1 flex-col px-4 pt-[var(--app-header-height)]">
        <h1 className="text-2xl font-bold text-foreground">{t("missions.title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("missions.subtitle")}</p>
        <MissionsList initialMissions={missionsResult.status === "success" ? missionsResult.missions : []} />
      </div>
    </main>
  );
}
