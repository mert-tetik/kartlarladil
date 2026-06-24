import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
}));

describe("OnboardingForm", () => {
  it("defaults the UI locale to the browser language and tiers to All", async () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OnboardingForm nextPath="/card-draw" />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLInputElement>(
          'input[name="preferredUiLocale"]',
        ),
      ).toHaveValue("en");
    });

    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="preferredLanguageCode"]',
      ),
    ).toHaveValue("tr");

    const tierInputs = container.querySelectorAll<HTMLInputElement>(
      'input[name="preferredTier"]',
    );
    expect(tierInputs[0]).toHaveAttribute("value", "all");
    expect(tierInputs[0]).toBeChecked();
  });

  it("defaults the learning language to English when the browser language is not English", async () => {
    vi.stubGlobal("navigator", { language: "de-DE" });

    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OnboardingForm nextPath="/card-draw" />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLInputElement>(
          'input[name="preferredUiLocale"]',
        ),
      ).toHaveValue("de");
    });

    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="preferredLanguageCode"]',
      ),
    ).toHaveValue("en");

    vi.unstubAllGlobals();
  });
});
