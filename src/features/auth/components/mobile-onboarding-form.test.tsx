import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import {
  updateLanguagePreferenceAction,
  updateMobileLoginLanguagePreferencesAction,
} from "@/features/auth/actions";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
  updateLanguagePreferenceAction: vi.fn().mockResolvedValue(undefined),
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
  beforeEach(() => {
    window.localStorage.clear();
  });

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
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();
    });
    expect(container.querySelector('[data-onboarding-language-flag="en"]')).toHaveAttribute("data-selected", "true");
    expect(container.querySelector('[data-onboarding-language-flag="tr"]')).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Geri dön" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ana dilinizi seçiniz" })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "Dil seç" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Profil fotoğrafı seç" })).toBeVisible();
    });
    expect(screen.getByRole("button", { name: "Kedi" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Geri dön" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hangi dili öğrenmek istersiniz?" })).toBeVisible();
    });
  });

  it("keeps the latest language selection visible during the step transition", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={testUser}>
          <MobileOnboardingForm countryCode="TR" />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    const germanFlag = container.querySelector('[data-onboarding-language-flag="de"]');
    await user.click(germanFlag?.closest("button") as HTMLButtonElement);
    expect(germanFlag).toHaveAttribute("data-selected", "true");

    const transitionContinueButton = Array.from(container.querySelectorAll("button")).find(
      (button) => !button.hasAttribute("aria-pressed"),
    ) as HTMLButtonElement;
    await user.click(transitionContinueButton);

    const transition = container.querySelector('[data-gateway-flow-phase="exit"]');
    expect(transition).toBeInTheDocument();
    expect(transition?.querySelector('[data-onboarding-language-flag="de"]'))
      .toHaveAttribute("data-selected", "true");
  });

  it("refreshes both login languages without rendering or submitting the avatar step", async () => {
    const user = userEvent.setup();
    vi.mocked(updateLanguagePreferenceAction).mockClear();
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
    expect(updateLanguagePreferenceAction).not.toHaveBeenCalled();
    const advanceButton = Array.from(form.querySelectorAll("button")).find((button) => !button.hasAttribute("aria-pressed"));
    await user.click(advanceButton as HTMLButtonElement);

    expect(form).toHaveAttribute("data-mobile-onboarding-step", "learning");
    await waitFor(() => {
      expect(container.querySelector('[data-onboarding-language-flag="en"]')).not.toBeInTheDocument();
    });
    await selectLanguage("de");
    expect(updateLanguagePreferenceAction).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLButtonElement>("[data-login-language-submit]")).toBeInTheDocument();
    expect(form).toHaveAttribute("data-mobile-onboarding-step", "learning");
    expect(container.querySelector('input[name="profilePictureIndex"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="preferredTier"]')).not.toBeInTheDocument();
  });

  it("continues immediately while login language preferences save in the background", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    let resolveSave!: (value: { status: "success"; message: string }) => void;
    vi.mocked(updateMobileLoginLanguagePreferencesAction).mockImplementationOnce(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    const { container } = render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={testUser}>
          <MobileOnboardingForm countryCode="TR" mode="login-language-refresh" onComplete={onComplete} />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    const selectLanguage = async (code: string) => {
      const flag = container.querySelector(`[data-onboarding-language-flag="${code}"]`);
      await user.click(flag?.closest("button") as HTMLButtonElement);
    };

    await selectLanguage("en");
    const advanceButton = () => Array.from(container.querySelectorAll("button")).find(
      (button) => !button.hasAttribute("aria-pressed") && button.type !== "submit",
    ) as HTMLButtonElement;
    await user.click(advanceButton());
    const form = container.querySelector("form") as HTMLFormElement;
    await waitFor(() => expect(form).toHaveAttribute("data-mobile-onboarding-step", "learning"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Which language would you like to learn?" })).toBeVisible();
    });
    await selectLanguage("de");
    await waitFor(() => expect(container.querySelector("[data-login-language-submit]")).toBeInTheDocument());
    await user.click(container.querySelector("[data-login-language-submit]") as HTMLButtonElement);

    expect(onComplete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(updateMobileLoginLanguagePreferencesAction).toHaveBeenCalledTimes(1);
    });
    const submittedForm = vi.mocked(updateMobileLoginLanguagePreferencesAction).mock.calls[0][1] as FormData;
    expect(submittedForm.get("preferredUiLocale")).toBe("en");
    expect(submittedForm.get("preferredLanguageCode")).toBe("de");

    resolveSave({ status: "success", message: "" });
  });

});
