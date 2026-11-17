import { afterEach, describe, expect, it, vi } from "vitest";
import { getPerformanceDiagnosticsConsent } from "@/lib/performance-diagnostics";

describe("performance diagnostics consent lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares an in-flight consent request for the same account", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = getPerformanceDiagnosticsConsent("user-1");
    const second = getPerformanceDiagnosticsConsent("user-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(Response.json({
      enabled: false,
      has_decided: false,
      policy_version: "2026-11-18",
    }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { enabled: false, has_decided: false, policy_version: "2026-11-18" },
      { enabled: false, has_decided: false, policy_version: "2026-11-18" },
    ]);
  });
});
