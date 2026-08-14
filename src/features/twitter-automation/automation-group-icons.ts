export const AUTOMATION_GROUP_ICON_OPTIONS = [
  { value: "flag", label: "Flag", color: "#f7c96f" },
  { value: "instagram", label: "Instagram", color: "#f66f9c" },
  { value: "youtube", label: "YouTube", color: "#ff6a62" },
  { value: "x", label: "X", color: "#e9f2ec" },
  { value: "tiktok", label: "TikTok", color: "#65decf" },
] as const;

export type AutomationGroupIcon = (typeof AUTOMATION_GROUP_ICON_OPTIONS)[number]["value"];

export const AUTOMATION_GROUP_ICON_IDS = AUTOMATION_GROUP_ICON_OPTIONS.map((option) => option.value) as [AutomationGroupIcon, ...AutomationGroupIcon[]];

export function normalizeAutomationGroupIcon(value: unknown): AutomationGroupIcon {
  return AUTOMATION_GROUP_ICON_IDS.includes(value as AutomationGroupIcon) ? value as AutomationGroupIcon : "flag";
}
