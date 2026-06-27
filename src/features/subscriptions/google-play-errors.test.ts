import { getGooglePlayErrorDetail, getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";

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
});
