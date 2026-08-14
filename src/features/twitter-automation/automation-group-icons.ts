export const AUTOMATION_GROUP_ICON_OPTIONS = [
  { value: "flag", label: "Türkiye", category: "country", src: "/automation-group-icons/flags/tr.svg" },
  { value: "gb", label: "United Kingdom", category: "country", src: "/automation-group-icons/flags/gb.svg" },
  { value: "us", label: "United States", category: "country", src: "/automation-group-icons/flags/us.svg" },
  { value: "de", label: "Germany", category: "country", src: "/automation-group-icons/flags/de.svg" },
  { value: "ru", label: "Russia", category: "country", src: "/automation-group-icons/flags/ru.svg" },
  { value: "fr", label: "France", category: "country", src: "/automation-group-icons/flags/fr.svg" },
  { value: "es", label: "Spain", category: "country", src: "/automation-group-icons/flags/es.svg" },
  { value: "it", label: "Italy", category: "country", src: "/automation-group-icons/flags/it.svg" },
  { value: "pt", label: "Portugal", category: "country", src: "/automation-group-icons/flags/pt.svg" },
  { value: "nl", label: "Netherlands", category: "country", src: "/automation-group-icons/flags/nl.svg" },
  { value: "pl", label: "Poland", category: "country", src: "/automation-group-icons/flags/pl.svg" },
  { value: "sa", label: "Saudi Arabia", category: "country", src: "/automation-group-icons/flags/sa.svg" },
  { value: "jp", label: "Japan", category: "country", src: "/automation-group-icons/flags/jp.svg" },
  { value: "kr", label: "South Korea", category: "country", src: "/automation-group-icons/flags/kr.svg" },
  { value: "cn", label: "China", category: "country", src: "/automation-group-icons/flags/cn.svg" },
  { value: "youtube", label: "YouTube", category: "social", src: "/automation-group-icons/social/youtube.svg" },
  { value: "instagram", label: "Instagram", category: "social", src: "/automation-group-icons/social/instagram.svg" },
  { value: "tiktok", label: "TikTok", category: "social", src: "/automation-group-icons/social/tiktok.svg" },
  { value: "x", label: "X", category: "social", src: "/automation-group-icons/social/x.svg" },
  { value: "threads", label: "Threads", category: "social", src: "/automation-group-icons/social/threads.svg" },
  { value: "pinterest", label: "Pinterest", category: "social", src: "/automation-group-icons/social/pinterest.svg" },
  { value: "facebook", label: "Facebook", category: "social", src: "/automation-group-icons/social/facebook.svg" },
] as const;

export type AutomationGroupIcon = (typeof AUTOMATION_GROUP_ICON_OPTIONS)[number]["value"];

export const AUTOMATION_GROUP_ICON_IDS = AUTOMATION_GROUP_ICON_OPTIONS.map((option) => option.value) as [AutomationGroupIcon, ...AutomationGroupIcon[]];

export function normalizeAutomationGroupIcon(value: unknown): AutomationGroupIcon {
  return AUTOMATION_GROUP_ICON_IDS.includes(value as AutomationGroupIcon) ? value as AutomationGroupIcon : "flag";
}
