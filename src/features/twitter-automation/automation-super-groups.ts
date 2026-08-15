export const AUTOMATION_SUPER_GROUP_ICON_OPTIONS = [
  { value: "social", label: "Social media" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "text", label: "Text" },
] as const;

export const DEFAULT_AUTOMATION_SUPER_GROUP_COLOR = "#16232c";

export type AutomationSuperGroupIcon = (typeof AUTOMATION_SUPER_GROUP_ICON_OPTIONS)[number]["value"];

export const AUTOMATION_SUPER_GROUP_ICON_IDS = AUTOMATION_SUPER_GROUP_ICON_OPTIONS.map((option) => option.value) as [AutomationSuperGroupIcon, ...AutomationSuperGroupIcon[]];

export interface AutomationSuperGroup {
  id: string;
  name: string;
  icon: AutomationSuperGroupIcon;
  color?: string;
  hidden?: boolean;
}

export function normalizeAutomationSuperGroupIcon(value: unknown): AutomationSuperGroupIcon {
  return AUTOMATION_SUPER_GROUP_ICON_IDS.includes(value as AutomationSuperGroupIcon) ? value as AutomationSuperGroupIcon : "social";
}

export function isAutomationSuperGroupColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/iu.test(value);
}

export function normalizeAutomationSuperGroupColor(value: unknown) {
  return isAutomationSuperGroupColor(value) ? value : DEFAULT_AUTOMATION_SUPER_GROUP_COLOR;
}
