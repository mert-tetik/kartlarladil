import type { Tier } from "@/types/domain";

export const TIERS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

export const TIER_REQUIREMENTS: Record<Tier, number> = {
  A1: 2,
  A2: 3,
  B1: 4,
  B2: 5,
  C1: 6,
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
  }
> = {
  A1: {
    border: "border-emerald-500/70",
    surface: "from-emerald-50 via-white to-slate-50",
    accent: "bg-emerald-500",
    text: "text-emerald-800",
  },
  A2: {
    border: "border-sky-500/70",
    surface: "from-sky-50 via-white to-slate-50",
    accent: "bg-sky-500",
    text: "text-sky-800",
  },
  B1: {
    border: "border-violet-500/70",
    surface: "from-violet-50 via-white to-slate-50",
    accent: "bg-violet-500",
    text: "text-violet-800",
  },
  B2: {
    border: "border-amber-500/70",
    surface: "from-amber-50 via-white to-slate-50",
    accent: "bg-amber-500",
    text: "text-amber-800",
  },
  C1: {
    border: "border-rose-500/70",
    surface: "from-rose-50 via-white to-slate-50",
    accent: "bg-rose-500",
    text: "text-rose-800",
  },
};
