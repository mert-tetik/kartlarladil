import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
}));

describe("OnboardingForm", () => {
  it("defaults the learning language to English, native language to Turkish, and tier to All", async () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OnboardingForm nextPath="/card-draw" />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLInputElement>(
          'input[name="preferredLanguageCode"]',
        ),
      ).toHaveValue("en");
    });

    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="preferredUiLocale"]',
      ),
    ).toHaveValue("tr");

    const tierInputs = container.querySelectorAll<HTMLInputElement>(
      'input[name="preferredTier"]',
    );
    expect(tierInputs[0]).toHaveAttribute("value", "all");
    expect(tierInputs[0]).toBeChecked();
  });
});
