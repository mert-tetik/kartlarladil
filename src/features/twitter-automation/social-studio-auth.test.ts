import { describe, expect, it } from "vitest";
import {
  createSocialStudioSession,
  hasSocialStudioSession,
  isSocialStudioAdminCredentials,
  SOCIAL_STUDIO_SESSION_COOKIE,
} from "@/features/twitter-automation/social-studio-auth";

describe("social studio admin session", () => {
  it("accepts only the configured developer credentials", () => {
    expect(isSocialStudioAdminCredentials("tetikmert", "m25041979")).toBe(true);
    expect(isSocialStudioAdminCredentials("tetikmert", "wrong-password")).toBe(false);
    expect(isSocialStudioAdminCredentials("another-user", "m25041979")).toBe(false);
  });

  it("accepts signed sessions and rejects altered sessions", () => {
    const session = createSocialStudioSession();

    expect(hasSocialStudioSession(`${SOCIAL_STUDIO_SESSION_COOKIE}=${session}`)).toBe(true);
    expect(hasSocialStudioSession(`${SOCIAL_STUDIO_SESSION_COOKIE}=${session}x`)).toBe(false);
    expect(hasSocialStudioSession(null)).toBe(false);
  });
});
