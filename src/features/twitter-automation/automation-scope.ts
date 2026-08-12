export type AutomationScope = "production" | "test";

const AUTOMATION_OWNER_KEYS: Record<AutomationScope, string> = {
  production: "social-studio",
  test: "social-studio-test",
};

export function normalizeAutomationScope(value: unknown): AutomationScope {
  return value === "test" ? "test" : "production";
}

export function automationOwnerKey(scope: AutomationScope) {
  return AUTOMATION_OWNER_KEYS[scope];
}

export function automationScopeSearchParams(scope: AutomationScope) {
  return scope === "test" ? "?scope=test" : "";
}
