import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SOCIAL_STUDIO_AUTH_SECRET = "renderer-test-secret";
  process.env.SOCIAL_AUTOMATION_INTERNAL_SECRET = "automation-test-secret";
});

vi.mock("@/features/developer/developer-auth", () => ({
  hasDeveloperAdminRequest: vi.fn().mockResolvedValue(false),
}));

import {
  AUTOMATION_RENDERER_SESSION_COOKIE,
  SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE,
  createAutomationRendererSession,
  createSocialAutomationInternalSession,
  getAutomationRendererSession,
  hasSocialStudioAutomationSession,
  hasSocialStudioSession,
} from "@/features/twitter-automation/social-studio-auth";

describe("social studio admin session", () => {
  it("accepts only an environment-secret internal automation session", async () => {
    const session = createSocialAutomationInternalSession();

    await expect(hasSocialStudioSession(`${SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE}=${session}`)).resolves.toBe(true);
    await expect(hasSocialStudioSession(`${SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE}=${session}x`)).resolves.toBe(false);
    await expect(hasSocialStudioSession(null)).resolves.toBe(false);
  });

  it("accepts a renderer-only session without granting normal studio access", async () => {
    const rendererId = "7d13ccca-d537-4a5a-9a08-20df9c391007";
    const session = createAutomationRendererSession(rendererId, "social-studio");
    const cookie = `${AUTOMATION_RENDERER_SESSION_COOKIE}=${session}`;

    await expect(hasSocialStudioSession(cookie)).resolves.toBe(false);
    await expect(hasSocialStudioAutomationSession(cookie)).resolves.toBe(true);
    expect(getAutomationRendererSession(cookie)).toMatchObject({ rendererId, ownerKey: "social-studio" });
  });
});
