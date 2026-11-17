import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PerformanceDiagnosticsDisclosure } from "@/features/auth/components/performance-diagnostics-disclosure";
import { PERFORMANCE_DIAGNOSTICS_POLICY_VERSION } from "@/lib/performance-diagnostics-contract";

const mocks = vi.hoisted(() => ({
  getTwaMode: vi.fn(),
  getConsent: vi.fn(),
  notifyConsentChanged: vi.fn(),
  useAuthSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/card-draw" }));
vi.mock("@/features/auth/auth-client", () => ({ useAuthSession: mocks.useAuthSession }));
vi.mock("@/features/install-app/twa-mode", () => ({ getTwaMode: mocks.getTwaMode }));
vi.mock("@/i18n/locale-provider", () => ({ useLocale: () => ({ locale: "en" }) }));
vi.mock("@/lib/performance-diagnostics", () => ({
  getPerformanceDiagnosticsConsent: mocks.getConsent,
  notifyPerformanceDiagnosticsConsentChanged: mocks.notifyConsentChanged,
}));
vi.mock("@/components/mobile-bottom-sheet-shell", () => ({
  MobileBottomSheetShell: ({
    open,
    onClose,
    title,
    children,
  }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => (
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
        <button type="button" aria-label="Dismiss" onClick={onClose}>×</button>
      </section>
    ) : null
  ),
}));

describe("performance diagnostics disclosure", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockReset();
    mocks.getConsent.mockReset();
    mocks.getTwaMode.mockReturnValue(true);
    mocks.useAuthSession.mockReturnValue({
      user: { id: "user-1", profile: { onboardingCompleted: true } },
      isSessionReady: true,
    });
    mocks.notifyConsentChanged.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the disclosure first and records an explicit decline without enabling collection", async () => {
    mocks.getConsent.mockResolvedValueOnce({
      enabled: false,
      has_decided: false,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
    mocks.fetch.mockResolvedValueOnce(Response.json({ enabled: false }));

    render(<PerformanceDiagnosticsDisclosure />);
    await screen.findByRole("dialog", { name: "Performance diagnostics" });

    expect(mocks.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [, request] = mocks.fetch.mock.calls[0];
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toEqual({
      enabled: false,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
    expect(mocks.notifyConsentChanged).toHaveBeenCalledWith(false, true);
  });

  it("does not show a prompt after the user has already decided", async () => {
    mocks.getConsent.mockResolvedValueOnce({
      enabled: false,
      has_decided: true,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });

    render(<PerformanceDiagnosticsDisclosure />);
    await waitFor(() => expect(mocks.getConsent).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not treat dismissing the disclosure as consent", async () => {
    mocks.getConsent.mockResolvedValueOnce({
      enabled: false,
      has_decided: false,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });

    render(<PerformanceDiagnosticsDisclosure />);
    await screen.findByRole("dialog", { name: "Performance diagnostics" });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.notifyConsentChanged).not.toHaveBeenCalled();
  });

  it("enables diagnostics only after the affirmative action", async () => {
    mocks.getConsent.mockResolvedValueOnce({
      enabled: false,
      has_decided: false,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
    mocks.fetch.mockResolvedValueOnce(Response.json({ enabled: true }));

    render(<PerformanceDiagnosticsDisclosure />);
    await screen.findByRole("dialog", { name: "Performance diagnostics" });
    expect(mocks.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Allow diagnostics" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [, request] = mocks.fetch.mock.calls[0];
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toEqual({
      enabled: true,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
    expect(mocks.notifyConsentChanged).toHaveBeenCalledWith(true, true);
  });
});
