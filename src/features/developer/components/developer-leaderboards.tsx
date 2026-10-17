"use client";

import { Flame, Layers3, LoaderCircle, LogIn, Medal, Percent, Target, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type BoardKey = "points" | "streaks" | "medals" | "app_entries" | "learned_cards" | "quiz_attempts" | "quiz_accuracy";

interface LeaderboardStats {
  points: number;
  streak: number;
  medals: number;
  activeDays: number;
  appEntries: number | null;
  learnedCards: number;
  quizAttempts: number;
  quizCorrect: number;
  quizAccuracy: number | null;
}

type LeaderboardRanks = Partial<Record<BoardKey, number>>;

interface LeaderboardEntry {
  userId: string;
  rank: number;
  displayName: string;
  value: number;
  secondaryValue: number | null;
  stats: LeaderboardStats;
  ranks: LeaderboardRanks;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  nextOffset: number | null;
  total: number;
}

const boardMeta: Array<{
  key: BoardKey;
  title: string;
  description: string;
  icon: typeof Trophy;
  accent: string;
}> = [
  {
    key: "points",
    title: "Puan leaderboardı",
    description: "Oyundaki toplam puana göre sıralama.",
    icon: Trophy,
    accent: "#2f7251",
  },
  {
    key: "streaks",
    title: "Streak leaderboardı",
    description: "Oyundaki en uzun günlük streak değerine göre sıralama.",
    icon: Flame,
    accent: "#d65a32",
  },
  {
    key: "medals",
    title: "Madalya leaderboardı",
    description: "Oyunda kazanılan toplam madalya sayısına göre sıralama.",
    icon: Medal,
    accent: "#b87928",
  },
  {
    key: "app_entries",
    title: "En çok uygulamaya girenler",
    description: "Streak’ten bağımsız toplam aktif gün; varsa giriş event’i de gösterilir.",
    icon: LogIn,
    accent: "#4f6fba",
  },
  {
    key: "learned_cards",
    title: "En çok kart öğrenenler",
    description: "Öğrenilmiş kart sayısına göre sıralama.",
    icon: Layers3,
    accent: "#2b8a78",
  },
  {
    key: "quiz_attempts",
    title: "En çok quiz çözenler",
    description: "Toplam quiz denemesi sayısına göre sıralama.",
    icon: Target,
    accent: "#5d83c5",
  },
  {
    key: "quiz_accuracy",
    title: "En yüksek quiz doğruluğu",
    description: "En az 5 denemesi olan kullanıcıların başarı oranı.",
    icon: Percent,
    accent: "#9a63bd",
  },
];

function formatValue(board: BoardKey, entry: LeaderboardEntry) {
  const value = entry.value.toLocaleString("tr-TR");

  if (board === "points") return `${value} puan`;
  if (board === "streaks") return `${value} gün`;
  if (board === "medals") return `${value} madalya`;
  if (board === "learned_cards") return `${value} kart`;
  if (board === "quiz_attempts") return `${value} deneme`;
  if (board === "quiz_accuracy") return `%${entry.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} · ${entry.secondaryValue ?? 0} deneme`;

  return entry.secondaryValue === null
    ? `${value} aktif gün`
    : `${value} aktif gün · ${entry.secondaryValue.toLocaleString("tr-TR")} giriş`;
}

function formatRank(rank: number | undefined) {
  return rank ? `#${rank.toLocaleString("tr-TR")}` : "—";
}

function UserLeaderboardDetails({ entry, accent }: { entry: LeaderboardEntry; accent: string }) {
  const metrics = [
    ["Puan", `${entry.stats.points.toLocaleString("tr-TR")} · ${formatRank(entry.ranks.points)}`],
    ["Streak", `${entry.stats.streak.toLocaleString("tr-TR")} gün · ${formatRank(entry.ranks.streaks)}`],
    ["Madalya", `${entry.stats.medals.toLocaleString("tr-TR")} · ${formatRank(entry.ranks.medals)}`],
    ["Aktif gün", `${entry.stats.activeDays.toLocaleString("tr-TR")} · ${formatRank(entry.ranks.app_entries)}`],
    ["Öğrenilmiş kart", `${entry.stats.learnedCards.toLocaleString("tr-TR")} · ${formatRank(entry.ranks.learned_cards)}`],
    ["Quiz denemesi", `${entry.stats.quizAttempts.toLocaleString("tr-TR")} · ${formatRank(entry.ranks.quiz_attempts)}`],
    ["Quiz doğruluğu", `${entry.stats.quizAccuracy === null ? "—" : `%${entry.stats.quizAccuracy.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`} · ${formatRank(entry.ranks.quiz_accuracy)}`],
  ] as const;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-1 hidden rounded-lg p-3 text-[11px] group-hover:block group-focus:block" style={{ backgroundColor: accent }}>
      <p className="mb-2 font-semibold text-white">{entry.displayName} · diğer leaderboardlar</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {metrics.map(([label, value]) => (
          <div className="flex min-w-0 items-center justify-between gap-2" key={label}>
            <span className="truncate text-white/75">{label}</span>
            <strong className="shrink-0 tabular-nums text-white">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Board({ board }: { board: (typeof boardMeta)[number] }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (offset: number, append: boolean) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(
        `/api/developer/analytics/leaderboards?board=${board.key}&offset=${offset}&limit=10`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("leaderboard request failed");
      }

      const payload = await response.json() as LeaderboardResponse;
      setEntries((current) => append ? [...current, ...payload.entries] : payload.entries);
      setNextOffset(payload.nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [board.key]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const Icon = board.icon;

  return (
    <section className="relative rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5">
      <div className="-mx-5 -mt-5 mb-5 flex min-h-11 items-center gap-2 rounded-t-xl px-4 py-2.5" style={{ backgroundColor: board.accent }}>
        <Icon className="size-4 text-white" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">{board.title}</h3>
      </div>

      <p className="text-xs leading-5 text-[#7b867e]">{board.description}</p>

      <div className="mt-4">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#89938b]">
            <LoaderCircle className="size-4 animate-spin" />
            Yükleniyor
          </div>
        ) : error && entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#a25a45]">Leaderboard verisi alınamadı.</p>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#89938b]">Henüz yeterli veri yok.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                aria-label={`${entry.displayName} leaderboard detayları`}
                className="group relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 outline-none odd:bg-[#f4f6f1] focus:ring-2 focus:ring-[#2f7251]/30 hover:z-20 focus:z-20"
                key={entry.userId}
                tabIndex={0}
              >
                <span className="text-center text-xs font-bold tabular-nums text-[#89938b]">{entry.rank}</span>
                <span className="truncate text-sm font-medium text-[#445247]">{entry.displayName}</span>
                <strong className="text-right text-xs tabular-nums text-[#26342b]">{formatValue(board.key, entry)}</strong>
                <UserLeaderboardDetails accent={board.accent} entry={entry} />
              </div>
            ))}
          </div>
        )}
      </div>

      {nextOffset !== null ? (
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ccd4c9] bg-white px-3 py-2.5 text-sm font-semibold text-[#405548] transition-colors hover:bg-[#f1f4ee] disabled:cursor-wait disabled:opacity-60"
          disabled={loading}
          onClick={() => void load(nextOffset, true)}
          type="button"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {loading ? "Yükleniyor" : "Daha fazla yükle"}
        </button>
      ) : (
        <p className="mt-4 text-center text-xs text-[#89938b]">Tüm sonuçlar yüklendi · {entries.length} kullanıcı</p>
      )}
    </section>
  );
}

export function DeveloperLeaderboards() {
  return (
    <section className="mt-6" aria-labelledby="developer-leaderboards-title">
      <div className="mb-4">
        <h2 id="developer-leaderboards-title" className="text-xl font-semibold text-[#26342b]">Leaderboardlar</h2>
        <p className="mt-1 text-sm text-[#7b867e]">Oyundaki sıralamaları ve streak’ten bağımsız uygulama girişlerini karşılaştırın.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">{boardMeta.map((board) => <Board board={board} key={board.key} />)}</div>
    </section>
  );
}
