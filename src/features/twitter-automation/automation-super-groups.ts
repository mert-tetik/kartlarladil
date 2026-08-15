export const AUTOMATION_SUPER_GROUP_ICON_OPTIONS = [
  { value: "social", label: "Social media" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "text", label: "Text" },
] as const;

export type AutomationSuperGroupIcon = (typeof AUTOMATION_SUPER_GROUP_ICON_OPTIONS)[number]["value"];

export const AUTOMATION_SUPER_GROUP_ICON_IDS = AUTOMATION_SUPER_GROUP_ICON_OPTIONS.map((option) => option.value) as [AutomationSuperGroupIcon, ...AutomationSuperGroupIcon[]];

export interface AutomationSuperGroup {
  id: string;
  name: string;
  icon: AutomationSuperGroupIcon;
}

export function normalizeAutomationSuperGroupIcon(value: unknown): AutomationSuperGroupIcon {
  return AUTOMATION_SUPER_GROUP_ICON_IDS.includes(value as AutomationSuperGroupIcon) ? value as AutomationSuperGroupIcon : "social";
}
