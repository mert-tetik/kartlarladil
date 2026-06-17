import type { Tier } from "@/types/domain";

export const TIERS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

export const TIER_REQUIREMENTS: Record<Tier, number> = {
  A1: 4,
  A2: 4,
  B1: 6,
  B2: 6,
  C1: 8,
};

export const TIER_LABELS: Record<Tier, string> = {
  A1: "Temel",
  A2: "Güvenli",
  B1: "Akıcı",
  B2: "Usta",
  C1: "Seçkin",
};

export const TIER_STYLES: Record<
  Tier,
  {
    border: string;
    surface: string;
    accent: string;
    text: string;
    progress: string;
    backPanel: string;
    backBorder: string;
    backText: string;
  }
> = {
  A1: {
    border: "border-emerald-500/70 dark:border-emerald-400/70",
    surface: "from-emerald-50 via-white to-slate-50 dark:from-emerald-950 dark:via-[#171717] dark:to-emerald-950",
    accent: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-800 dark:text-white",
    progress: "bg-emerald-500 dark:bg-white",
    backPanel: "from-emerald-600 via-emerald-500 to-emerald-700",
    backBorder: "border-emerald-700/50",
    backText: "text-emerald-700",
  },
  A2: {
    border: "border-sky-500/70 dark:border-sky-400/70",
    surface: "from-sky-50 via-white to-slate-50 dark:from-sky-950 dark:via-[#171717] dark:to-sky-950",
    accent: "bg-sky-500 dark:bg-sky-400",
    text: "text-sky-800 dark:text-white",
    progress: "bg-sky-500 dark:bg-white",
    backPanel: "from-sky-600 via-sky-500 to-blue-700",
    backBorder: "border-sky-700/50",
    backText: "text-sky-700",
  },
  B1: {
    border: "border-violet-500/70 dark:border-violet-400/70",
    surface: "from-violet-50 via-white to-slate-50 dark:from-violet-950 dark:via-[#171717] dark:to-violet-950",
    accent: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-800 dark:text-white",
    progress: "bg-violet-500 dark:bg-white",
    backPanel: "from-violet-600 via-violet-500 to-fuchsia-700",
    backBorder: "border-violet-700/50",
    backText: "text-violet-700",
  },
  B2: {
    border: "border-amber-500/70 dark:border-amber-400/70",
    surface: "from-amber-50 via-white to-slate-50 dark:from-amber-950 dark:via-[#171717] dark:to-amber-950",
    accent: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-800 dark:text-white",
    progress: "bg-amber-500 dark:bg-white",
    backPanel: "from-amber-500 via-yellow-500 to-amber-700",
    backBorder: "border-amber-700/50",
    backText: "text-amber-700",
  },
  C1: {
    border: "border-rose-500/70 dark:border-rose-400/70",
    surface: "from-rose-50 via-white to-slate-50 dark:from-rose-950 dark:via-[#171717] dark:to-rose-950",
    accent: "bg-rose-500 dark:bg-rose-400",
    text: "text-rose-800 dark:text-white",
    progress: "bg-rose-500 dark:bg-white",
    backPanel: "from-rose-600 via-rose-500 to-red-700",
    backBorder: "border-rose-700/50",
    backText: "text-rose-700",
  },
};
