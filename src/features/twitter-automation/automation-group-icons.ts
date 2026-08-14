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
  { value: "instagram", label: "Instagram", category: "social", src: "/automation-group-icons/social/instagram.svg" },
  { value: "youtube", label: "YouTube", category: "social", src: "/automation-group-icons/social/youtube.svg" },
  { value: "tiktok", label: "TikTok", category: "social", src: "/automation-group-icons/social/tiktok.svg" },
  { value: "x", label: "X", category: "social", src: "/automation-group-icons/social/x.svg" },
  { value: "pinterest", label: "Pinterest", category: "social", src: "/automation-group-icons/social/pinterest.svg" },
  { value: "linkedin", label: "LinkedIn", category: "social", src: "/automation-group-icons/social/linkedin.svg" },
  { value: "facebook", label: "Facebook", category: "social", src: "/automation-group-icons/social/facebook.svg" },
  { value: "threads", label: "Threads", category: "social", src: "/automation-group-icons/social/threads.svg" },
  { value: "bluesky", label: "Bluesky", category: "social", src: "/automation-group-icons/social/bluesky.svg" },
  { value: "reddit", label: "Reddit", category: "social", src: "/automation-group-icons/social/reddit.svg" },
  { value: "discord", label: "Discord", category: "social", src: "/automation-group-icons/social/discord.svg" },
  { value: "telegram", label: "Telegram", category: "social", src: "/automation-group-icons/social/telegram.svg" },
  { value: "google-business", label: "Google Business", category: "social", src: "/automation-group-icons/social/googlebusinessprofile.ico" },
  { value: "slack", label: "Slack", category: "social", src: "/automation-group-icons/social/slack.svg" },
  { value: "mastodon", label: "Mastodon", category: "social", src: "/automation-group-icons/social/mastodon.svg" },
  { value: "nostr", label: "Nostr", category: "social", src: "/automation-group-icons/social/nostr.svg" },
  { value: "lemmy", label: "Lemmy", category: "social", src: "/automation-group-icons/social/lemmy.svg" },
  { value: "devto", label: "Dev.to", category: "social", src: "/automation-group-icons/social/devdotto.svg" },
  { value: "hashnode", label: "Hashnode", category: "social", src: "/automation-group-icons/social/hashnode.svg" },
  { value: "wordpress", label: "WordPress", category: "social", src: "/automation-group-icons/social/wordpress.svg" },
  { value: "whop", label: "Whop", category: "social", src: "/automation-group-icons/social/whop.svg" },
  { value: "listmonk", label: "Listmonk", category: "social", src: "/automation-group-icons/social/listmonk.svg" },
] as const;

export type AutomationGroupIcon = (typeof AUTOMATION_GROUP_ICON_OPTIONS)[number]["value"];

export const AUTOMATION_GROUP_ICON_IDS = AUTOMATION_GROUP_ICON_OPTIONS.map((option) => option.value) as [AutomationGroupIcon, ...AutomationGroupIcon[]];

export function normalizeAutomationGroupIcon(value: unknown): AutomationGroupIcon {
  return AUTOMATION_GROUP_ICON_IDS.includes(value as AutomationGroupIcon) ? value as AutomationGroupIcon : "flag";
}
