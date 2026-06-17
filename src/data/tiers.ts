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
    backPanel: string;
    backBorder: string;
    backText: string;
  }
> = {
  A1: {
    border: "border-emerald-500/70",
    surface: "from-emerald-50 via-white to-slate-50",
    accent: "bg-emerald-500",
    text: "text-emerald-800",
    backPanel: "from-emerald-600 via-emerald-500 to-emerald-700",
    backBorder: "border-emerald-700/50",
    backText: "text-emerald-700",
  },
  A2: {
    border: "border-sky-500/70",
    surface: "from-sky-50 via-white to-slate-50",
    accent: "bg-sky-500",
    text: "text-sky-800",
    backPanel: "from-sky-600 via-sky-500 to-blue-700",
    backBorder: "border-sky-700/50",
    backText: "text-sky-700",
  },
  B1: {
    border: "border-violet-500/70",
    surface: "from-violet-50 via-white to-slate-50",
    accent: "bg-violet-500",
    text: "text-violet-800",
    backPanel: "from-violet-600 via-violet-500 to-fuchsia-700",
    backBorder: "border-violet-700/50",
    backText: "text-violet-700",
  },
  B2: {
    border: "border-amber-500/70",
    surface: "from-amber-50 via-white to-slate-50",
    accent: "bg-amber-500",
    text: "text-amber-800",
    backPanel: "from-amber-500 via-yellow-500 to-amber-700",
    backBorder: "border-amber-700/50",
    backText: "text-amber-700",
  },
  C1: {
    border: "border-rose-500/70",
    surface: "from-rose-50 via-white to-slate-50",
    accent: "bg-rose-500",
    text: "text-rose-800",
    backPanel: "from-rose-600 via-rose-500 to-red-700",
    backBorder: "border-rose-700/50",
    backText: "text-rose-700",
  },
};
