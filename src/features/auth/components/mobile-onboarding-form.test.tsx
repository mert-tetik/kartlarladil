import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
}));

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: null,
    preferredUiLocale: null,
    preferredTier: null,
    onboardingCompleted: false,
    aiPracticePoints: 0,
    chestPoints: 0,
  },
};

describe("MobileOnboardingForm", () => {
  it("uses the country default and guides the user through language and avatar steps", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={testUser}>
          <MobileOnboardingForm countryCode="TR" />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: "Ana dilinizi seçiniz" })).toBeVisible();
    expect(container.querySelector<HTMLInputElement>('input[name="preferredUiLocale"]')).toHaveValue("tr");
    expect(container.querySelector<HTMLInputElement>('input[name="preferredLanguageCode"]')).toHaveValue("en");

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    expect(screen.getByRole("heading", { name: "Profil fotoğrafı seç" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Kedi" })).toBeVisible();
  });
});
