import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useLocalizedPricing } from "@/features/subscriptions/components/use-localized-pricing";
import { fetchExchangeRate } from "@/lib/geo-currency";

vi.mock("@/lib/geo-currency", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/geo-currency")>();

  return {
    ...original,
    fetchExchangeRate: vi.fn(),
  };
});

describe("useLocalizedPricing", () => {
  it("uses the server-detected currency and one exchange-rate request", async () => {
    vi.mocked(fetchExchangeRate).mockResolvedValue(46.48);

    const { result } = renderHook(() => useLocalizedPricing("TRY"));

    await waitFor(() => {
      expect(result.current.kind).toBe("ready");
    });

    expect(fetchExchangeRate).toHaveBeenCalledTimes(1);
    expect(fetchExchangeRate).toHaveBeenCalledWith("USD", "TRY");
    expect(result.current).toMatchObject({
      kind: "ready",
      currencyCode: "TRY",
      prices: {
        "basic:monthly": { amount: 139, currencyCode: "TRY" },
        "pro:monthly": { amount: 418, currencyCode: "TRY" },
      },
    });
  });

  it("falls back to the browser locale when the server header is absent", async () => {
    vi.mocked(fetchExchangeRate).mockResolvedValue(46.48);
    vi.stubGlobal("navigator", { language: "tr-TR" });

    const { result } = renderHook(() => useLocalizedPricing(null));

    await waitFor(() => {
      expect(result.current.kind).toBe("ready");
    });

    expect(fetchExchangeRate).toHaveBeenCalledWith("USD", "TRY");
    vi.unstubAllGlobals();
  });
});
