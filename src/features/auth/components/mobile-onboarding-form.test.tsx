import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
  updateMobileLoginLanguagePreferencesAction: vi.fn(),
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
  it("defaults to English unless English is the selected native language", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={testUser}>
          <MobileOnboardingForm countryCode="TR" />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    const selectNativeLanguage = async (code: string) => {
      const flag = container.querySelector(`[data-onboarding-language-flag="${code}"]`);
      await user.click(flag?.closest("button") as HTMLButtonElement);
    };

    await selectNativeLanguage("en");
    expect(container.querySelector<HTMLInputElement>('input[name="preferredLanguageCode"]')).toHaveValue("es");

    await selectNativeLanguage("de");
    expect(container.querySelector<HTMLInputElement>('input[name="preferredLanguageCode"]')).toHaveValue("en");
  });

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
    expect(container.querySelector('[data-onboarding-language-flag="tr"]')).toHaveAttribute("data-selected", "true");

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();
    expect(container.querySelector('[data-onboarding-language-flag="en"]')).toHaveAttribute("data-selected", "true");
    expect(container.querySelector('[data-onboarding-language-flag="tr"]')).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Geri dön" }));
    expect(screen.getByRole("heading", { name: "Ana dilinizi seçiniz" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Dil seç" }));

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    expect(screen.getByRole("heading", { name: "Profil fotoğrafı seç" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Kedi" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Geri dön" }));
    expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();
  });

  it("refreshes both login languages without rendering or submitting the avatar step", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={testUser}>
          <MobileOnboardingForm countryCode="TR" mode="login-language-refresh" />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    const selectLanguage = async (code: string) => {
      const flag = container.querySelector(`[data-onboarding-language-flag="${code}"]`);
      await user.click(flag?.closest("button") as HTMLButtonElement);
    };

    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toHaveAttribute("data-mobile-onboarding-mode", "login-language-refresh");
    expect(form).toHaveAttribute("data-mobile-onboarding-step", "native");
    await selectLanguage("en");
    const advanceButton = Array.from(form.querySelectorAll("button")).find((button) => !button.hasAttribute("aria-pressed"));
    await user.click(advanceButton as HTMLButtonElement);

    expect(form).toHaveAttribute("data-mobile-onboarding-step", "learning");
    expect(container.querySelector('[data-onboarding-language-flag="en"]')).not.toBeInTheDocument();
    await selectLanguage("de");
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')).toBeInTheDocument();
    expect(form).toHaveAttribute("data-mobile-onboarding-step", "learning");
    expect(container.querySelector('input[name="profilePictureIndex"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="preferredTier"]')).not.toBeInTheDocument();
  });
});
