import { describe, expect, it } from "vitest";
import {
  AUTOMATION_RENDERER_SESSION_COOKIE,
  createAutomationRendererSession,
  createSocialStudioSession,
  getAutomationRendererSession,
  hasSocialStudioAutomationSession,
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

  it("accepts a renderer-only session without granting a normal studio session", () => {
    const rendererId = "7d13ccca-d537-4a5a-9a08-20df9c391007";
    const session = createAutomationRendererSession(rendererId, "social-studio");
    const cookie = `${AUTOMATION_RENDERER_SESSION_COOKIE}=${session}`;

    expect(hasSocialStudioSession(cookie)).toBe(false);
    expect(hasSocialStudioAutomationSession(cookie)).toBe(true);
    expect(getAutomationRendererSession(cookie)).toMatchObject({ rendererId, ownerKey: "social-studio" });
  });
});
