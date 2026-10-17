const DARK_FOREGROUND = "#000000";
const LIGHT_FOREGROUND = "#ffffff";

function getLinearChannel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(hex: string) {
  const normalizedHex = hex.replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalizedHex)) return null;

  const expandedHex = normalizedHex.length === 3
    ? normalizedHex.split("").map((channel) => `${channel}${channel}`).join("")
    : normalizedHex;
  const channels = [0, 2, 4].map((offset) =>
    getLinearChannel(Number.parseInt(expandedHex.slice(offset, offset + 2), 16)));

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getContrastRatio(firstLuminance: number, secondLuminance: number) {
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks the more legible neutral text color for a solid hex background. */
export function getAccessibleForeground(backgroundHex: string) {
  const luminance = getRelativeLuminance(backgroundHex);
  if (luminance === null) return LIGHT_FOREGROUND;

  const darkContrast = getContrastRatio(luminance, getRelativeLuminance(DARK_FOREGROUND)!);
  const lightContrast = getContrastRatio(luminance, 1);
  return darkContrast >= lightContrast ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}
