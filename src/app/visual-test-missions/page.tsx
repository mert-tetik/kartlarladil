import type { Metadata } from "next";
import { randomInt } from "node:crypto";
import { MissionTestScreen } from "@/features/missions/components/mission-test-screen";
import { normalizeMissionTestSeed } from "@/features/missions/mission-test-fixtures";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Missions visual test | FoxiesDeck",
  robots: {
    index: false,
    follow: false,
  },
};

interface MissionTestPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MissionTestPage({ searchParams }: MissionTestPageProps) {
  const params = await searchParams;
  const seed = normalizeMissionTestSeed(params.seed, randomInt(1, 2_147_483_646));

  return <MissionTestScreen seed={seed} />;
}
