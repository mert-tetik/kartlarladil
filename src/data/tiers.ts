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
    softAccent: string;
    text: string;
    progress: string;
    backPanel: string;
    backBorder: string;
    backText: string;
  }
> = {
  A1: {
    border: "border-[color:var(--tier-a1)]/70",
    surface: "from-[var(--background-muted)] via-[var(--background-card)] to-[var(--background)]",
    accent: "bg-[var(--tier-a1)]",
    softAccent: "bg-[color-mix(in_oklab,var(--tier-a1)_18%,var(--background-card))]",
    text: "text-[var(--tier-a1-text)]",
    progress: "bg-[var(--tier-a1)] dark:bg-white",
    backPanel: "from-[var(--tier-a1)] via-[var(--accent-primary)] to-[var(--accent-secondary)]",
    backBorder: "border-[color:var(--tier-a1-text)]/50",
    backText: "text-[var(--tier-a1-text)]",
  },
  A2: {
    border: "border-[color:var(--tier-a2)]/70",
    surface: "from-[var(--background-muted)] via-[var(--background-card)] to-[var(--background)]",
    accent: "bg-[var(--tier-a2)]",
    softAccent: "bg-[color-mix(in_oklab,var(--tier-a2)_18%,var(--background-card))]",
    text: "text-[var(--tier-a2-text)]",
    progress: "bg-[var(--tier-a2)] dark:bg-white",
    backPanel: "from-[var(--tier-a2)] via-[var(--accent-secondary)] to-[var(--accent-primary)]",
    backBorder: "border-[color:var(--tier-a2-text)]/50",
    backText: "text-[var(--tier-a2-text)]",
  },
  B1: {
    border: "border-[color:var(--tier-b1)]/70",
    surface: "from-[var(--background-muted)] via-[var(--background-card)] to-[var(--background)]",
    accent: "bg-[var(--tier-b1)]",
    softAccent: "bg-[color-mix(in_oklab,var(--tier-b1)_18%,var(--background-card))]",
    text: "text-[var(--tier-b1-text)]",
    progress: "bg-[var(--tier-b1)] dark:bg-white",
    backPanel: "from-[var(--tier-b1)] via-[var(--accent-quaternary)] to-[var(--accent-secondary)]",
    backBorder: "border-[color:var(--tier-b1-text)]/50",
    backText: "text-[var(--tier-b1-text)]",
  },
  B2: {
    border: "border-[color:var(--tier-b2)]/70",
    surface: "from-[var(--background-muted)] via-[var(--background-card)] to-[var(--background)]",
    accent: "bg-[var(--tier-b2)]",
    softAccent: "bg-[color-mix(in_oklab,var(--tier-b2)_18%,var(--background-card))]",
    text: "text-[var(--tier-b2-text)]",
    progress: "bg-[var(--tier-b2)] dark:bg-white",
    backPanel: "from-[var(--tier-b2)] via-[var(--accent-primary)] to-[var(--accent-tertiary)]",
    backBorder: "border-[color:var(--tier-b2-text)]/50",
    backText: "text-[var(--tier-b2-text)]",
  },
  C1: {
    border: "border-[color:var(--tier-c1)]/70",
    surface: "from-[var(--background-muted)] via-[var(--background-card)] to-[var(--background)]",
    accent: "bg-[var(--tier-c1)]",
    softAccent: "bg-[color-mix(in_oklab,var(--tier-c1)_18%,var(--background-card))]",
    text: "text-[var(--tier-c1-text)]",
    progress: "bg-[var(--tier-c1)] dark:bg-white",
    backPanel: "from-[var(--tier-c1)] via-[var(--accent-primary)] to-[var(--accent-quaternary)]",
    backBorder: "border-[color:var(--tier-c1-text)]/50",
    backText: "text-[var(--tier-c1-text)]",
  },
};
