import { describe, expect, it } from "vitest";
import { automationOwnerKey, automationScopeSearchParams, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

describe("automation scope", () => {
  it("keeps the test table in a separate server-owned record", () => {
    expect(automationOwnerKey("production")).toBe("social-studio");
    expect(automationOwnerKey("test")).toBe("social-studio-test");
  });

  it("only accepts the explicit test scope from a client request", () => {
    expect(normalizeAutomationScope("test")).toBe("test");
    expect(normalizeAutomationScope("production")).toBe("production");
    expect(normalizeAutomationScope("anything-else")).toBe("production");
    expect(automationScopeSearchParams("test")).toBe("?scope=test");
  });
});
