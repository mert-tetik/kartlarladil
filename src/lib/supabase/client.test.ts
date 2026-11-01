import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient: mocks.createBrowserClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

describe("createSupabaseBrowserClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("keeps the PKCE verifier cookie accessible to the browser", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");

    createSupabaseBrowserClient();

    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-publishable-key",
      expect.objectContaining({
        cookieOptions: expect.objectContaining({ httpOnly: false }),
      }),
    );
  });
});
