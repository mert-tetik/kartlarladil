import { describe, expect, it } from "vitest";
import { AUTOMATION_GROUP_ICON_IDS, normalizeAutomationGroupIcon } from "@/features/twitter-automation/automation-group-icons";

describe("automation group icons", () => {
  it("keeps the supported saved icon selections", () => {
    expect(AUTOMATION_GROUP_ICON_IDS).toEqual([
      "flag", "gb", "us", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "sa", "jp", "kr", "cn",
      "instagram", "youtube", "tiktok", "x", "pinterest", "linkedin", "facebook", "threads", "bluesky", "reddit", "discord", "telegram", "google-business", "slack", "mastodon", "nostr", "lemmy", "devto", "hashnode", "wordpress", "whop", "listmonk",
    ]);
    expect(normalizeAutomationGroupIcon("youtube")).toBe("youtube");
  });

  it("falls back to the flag for old or invalid groups", () => {
    expect(normalizeAutomationGroupIcon(undefined)).toBe("flag");
    expect(normalizeAutomationGroupIcon("unknown")).toBe("flag");
  });
});
