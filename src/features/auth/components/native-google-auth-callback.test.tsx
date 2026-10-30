import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeGoogleAuthCallback } from "@/features/auth/components/native-google-auth-callback";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

describe("NativeGoogleAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/?nativeAuthCode=oauth-code&nativeAuthNext=%2F%3FshowOffer%3D1");
  });

  it("exchanges the callback code in the existing browser client without a page reload", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    render(<NativeGoogleAuthCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(window.location.search).toBe("");
    expect(mocks.replace).toHaveBeenCalledWith("/?showOffer=1");
  });
});
