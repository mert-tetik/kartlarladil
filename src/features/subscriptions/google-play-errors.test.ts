import {
  getGooglePlayErrorDetail,
  getGooglePlayErrorLogMetadata,
  getGooglePlayErrorMessage,
  isGooglePlayPurchaseCancellation,
} from "@/features/subscriptions/google-play-errors";

describe("google play error formatting", () => {
  it("keeps the original Google Play error detail visible", () => {
    const message = getGooglePlayErrorMessage(
      new Error("Product basic_monthly is not available on Google Play."),
      "Checkout failed.",
    );

    expect(message).toBe("Checkout failed. (Product basic_monthly is not available on Google Play.)");
  });

  it("falls back when the thrown value has no useful message", () => {
    expect(getGooglePlayErrorMessage({}, "Checkout failed.")).toBe("Checkout failed.");
  });

  it("redacts long token-like values from public details", () => {
    const detail = getGooglePlayErrorDetail(
      new Error("Verification failed for token abcdefghijklmnopqrstuvwxyzABCDEFG1234567890"),
    );

    expect(detail).toBe("Verification failed for token [redacted]");
  });

  it("logs only redacted error metadata and never includes request configuration", () => {
    const purchaseToken = "short-purchase-secret";
    const bearerToken = "sensitive-bearer-value";
    const error = Object.assign(
      new Error(`Verification failed for ${purchaseToken}; Authorization: Bearer ${bearerToken}`),
      {
        code: "403",
        status: 403,
        config: { url: `https://example.test/tokens/${purchaseToken}` },
        response: { config: { headers: { authorization: `Bearer ${bearerToken}` } } },
      },
    );

    const metadata = getGooglePlayErrorLogMetadata(error, [purchaseToken]);

    expect(metadata).toEqual({
      name: "Error",
      code: "403",
      status: 403,
      message: "Verification failed for [redacted]; Authorization: [redacted]",
    });
    expect(JSON.stringify(metadata)).not.toContain(purchaseToken);
    expect(JSON.stringify(metadata)).not.toContain(bearerToken);
    expect(JSON.stringify(metadata)).not.toContain("config");
  });

  it("returns the localized clientAppUnavailable message when the error contains it", () => {
    const message = getGooglePlayErrorMessage(
      new Error("PaymentService returned clientAppUnavailable"),
      "Checkout failed.",
      "Please make Chrome your default browser and try again.",
    );

    expect(message).toBe("Please make Chrome your default browser and try again.");
  });

  it("recognizes a payment overlay closed by the user", () => {
    expect(isGooglePlayPurchaseCancellation(new DOMException("The user aborted a request.", "AbortError"))).toBe(true);
    expect(isGooglePlayPurchaseCancellation(new Error("The operation was canceled by the user."))).toBe(true);
  });

  it("does not hide actual purchase failures", () => {
    expect(isGooglePlayPurchaseCancellation(new Error("Product basic_monthly is not available on Google Play."))).toBe(false);
  });
});
