import type { Tier } from "@/types/domain";

export interface CardDesignTierPalette {
  shellPrimary: string;
  shellHighlight: string;
  shellEnd: string;
  insetPrimary: string;
  insetMiddle: string;
  insetEnd: string;
  badge: string;
  label: string;
}

/**
 * Tier colors for the design reference card. A1 follows the supplied fresh
 * green card reference, A2 keeps the original cyan look, and the remaining
 * tiers use fully saturated app hues. Gradient geometry and metallic accents
 * stay consistent across tiers.
 */
function toFullySaturatedHex(color: string): string {
  const channels = [1, 3, 5].map((offset) => {
    return Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
  });
  const [red, green, blue] = channels;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const chroma = 1 - Math.abs(2 * lightness - 1);
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const rgb =
    hueSection < 1 ? [chroma, secondary, 0] :
    hueSection < 2 ? [secondary, chroma, 0] :
    hueSection < 3 ? [0, chroma, secondary] :
    hueSection < 4 ? [0, secondary, chroma] :
    hueSection < 5 ? [secondary, 0, chroma] :
    [chroma, 0, secondary];
  const offset = lightness - chroma / 2;

  return `#${rgb
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexWithWhite(color: string, amount: number): string {
  return `#${[1, 3, 5]
    .map((offset) => {
      const channel = Number.parseInt(color.slice(offset, offset + 2), 16);
      return Math.round(channel + (255 - channel) * amount)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

function mixHexWithBlack(color: string, amount: number): string {
  return `#${[1, 3, 5]
    .map((offset) => {
      const channel = Number.parseInt(color.slice(offset, offset + 2), 16);
      return Math.round(channel * (1 - amount))
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

function createTierPalette(sourceColor: string, fullySaturate = true): CardDesignTierPalette {
  const tierColor = fullySaturate ? toFullySaturatedHex(sourceColor) : sourceColor;

  return {
    shellPrimary: mixHexWithWhite(tierColor, 0.04),
    shellHighlight: mixHexWithWhite(tierColor, 0.18),
    shellEnd: tierColor,
    insetPrimary: mixHexWithWhite(tierColor, 0.05),
    insetMiddle: mixHexWithBlack(tierColor, 0.12),
    insetEnd: mixHexWithWhite(tierColor, 0.18),
    badge: tierColor,
    label: mixHexWithBlack(tierColor, 0.12),
  };
}

export const CARD_DESIGN_TIER_PALETTES: Record<Tier, CardDesignTierPalette> = {
  A1: {
    shellPrimary: "#6bd38a",
    shellHighlight: "#a9e6a7",
    shellEnd: "#55c875",
    insetPrimary: "#78d78d",
    insetMiddle: "#49bd6b",
    insetEnd: "#9ce1a0",
    badge: "#52bf70",
    label: "#61c97b",
  },
  A2: {
    shellPrimary: "#72dce5",
    shellHighlight: "#b9f5ee",
    shellEnd: "#55c9d5",
    insetPrimary: "#75e2e7",
    insetMiddle: "#53c5d2",
    insetEnd: "#82e5df",
    badge: "#36b9ca",
    label: "#43b9ca",
  },
  B1: createTierPalette("#b163ff", false),
  B2: createTierPalette("#f59e0b"),
  C1: createTierPalette("#fa5252", false),
};

export function getCardDesignTierPalette(tier: Tier): CardDesignTierPalette {
  return CARD_DESIGN_TIER_PALETTES[tier];
}
