import {
  BookOpen,
  Compass,
  Crown,
  Flame,
  Gem,
  GraduationCap,
  Languages,
  Medal,
  Star,
  Trophy,
} from "lucide-react";
import type { RankIconId } from "@/types/domain";

const RANK_ICON_TONES: Record<RankIconId, string> = {
  trophy: "text-amber-500",
  medal: "text-orange-500",
  book: "text-sky-600",
  compass: "text-teal-600",
  graduation: "text-indigo-600",
  star: "text-violet-600",
  languages: "text-emerald-600",
  gem: "text-fuchsia-600",
  crown: "text-yellow-600",
  flame: "text-rose-600",
};

export function RankIcon({ icon, className }: { icon: RankIconId; className?: string }) {
  switch (icon) {
    case "trophy":
      return <Trophy className={className} aria-hidden="true" />;
    case "medal":
      return <Medal className={className} aria-hidden="true" />;
    case "book":
      return <BookOpen className={className} aria-hidden="true" />;
    case "compass":
      return <Compass className={className} aria-hidden="true" />;
    case "graduation":
      return <GraduationCap className={className} aria-hidden="true" />;
    case "star":
      return <Star className={className} aria-hidden="true" />;
    case "languages":
      return <Languages className={className} aria-hidden="true" />;
    case "gem":
      return <Gem className={className} aria-hidden="true" />;
    case "crown":
      return <Crown className={className} aria-hidden="true" />;
    case "flame":
      return <Flame className={className} aria-hidden="true" />;
  }
}

export function getRankIconTone(icon: RankIconId) {
  return RANK_ICON_TONES[icon];
}
