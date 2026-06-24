import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
}));

vi.mock("@/lib/geo-currency", () => ({
  fetchGeoCurrencyInfo: vi.fn().mockResolvedValue(null),
}));

describe("OnboardingForm", () => {
  it("defaults the native language to Turkish and the first tier to All", async () => {
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
      ).toHaveValue("tr");
    });

    const tierInputs = screen.getAllByRole("radio");
    expect(tierInputs[0]).toHaveAttribute("value", "all");
    expect(tierInputs[0]).toBeChecked();
  });
});
