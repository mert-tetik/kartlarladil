export const AUTOMATION_GROUP_ICON_OPTIONS = [
  { value: "flag", label: "Türkiye", category: "country", src: "/flags/language/tr.webp" },
  { value: "gb", label: "United Kingdom", category: "country", src: "/flags/language/en.webp" },
  { value: "us", label: "United States", category: "country", src: "/automation-group-icons/flags/us.svg" },
  { value: "de", label: "Germany", category: "country", src: "/flags/language/de.webp" },
  { value: "ru", label: "Russia", category: "country", src: "/flags/language/ru.webp" },
  { value: "fr", label: "France", category: "country", src: "/flags/language/fr.webp" },
  { value: "es", label: "Spain", category: "country", src: "/flags/language/es.webp" },
  { value: "it", label: "Italy", category: "country", src: "/flags/language/it.webp" },
  { value: "pt", label: "Portugal", category: "country", src: "/flags/language/pt.webp" },
  { value: "nl", label: "Netherlands", category: "country", src: "/flags/language/nl.webp" },
  { value: "pl", label: "Poland", category: "country", src: "/flags/language/pl.webp" },
  { value: "sa", label: "Saudi Arabia", category: "country", src: "/flags/language/ar.webp" },
  { value: "jp", label: "Japan", category: "country", src: "/flags/language/ja.webp" },
  { value: "kr", label: "South Korea", category: "country", src: "/flags/language/ko.webp" },
  { value: "cn", label: "China", category: "country", src: "/flags/language/zh-CN.webp" },
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
