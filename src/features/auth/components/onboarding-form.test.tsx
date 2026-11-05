import { fireEvent, render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { GlobalTapVibration } from "@/components/global-tap-vibration";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { LocaleProvider } from "@/i18n/locale-provider";

const mocks = vi.hoisted(() => ({
  playFlowButtonSound: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock("@/lib/flow-button-sound", () => ({
  playFlowButtonSound: mocks.playFlowButtonSound,
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: mocks.vibrate,
}));

vi.mock("@/features/auth/actions", () => ({
  completeOnboardingAction: vi.fn(),
}));

describe("OnboardingForm", () => {
  beforeEach(() => {
    mocks.playFlowButtonSound.mockReset();
    mocks.vibrate.mockReset();
  });

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
    ).toHaveValue("es");

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

  it("plays the auth flow button sound for onboarding actions", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <GlobalTapVibration />
        <OnboardingForm nextPath="/card-draw" />
      </LocaleProvider>,
    );

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        '[data-language-picker="preferredLanguageCode"] > button',
      )!,
    );

    expect(mocks.playFlowButtonSound).toHaveBeenCalledWith("auth");
  });

  it("keeps the submit button fully opaque while disabled", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OnboardingForm nextPath="/card-draw" />
      </LocaleProvider>,
    );

    expect(container.querySelector('button[type="submit"]')).toHaveClass("disabled:opacity-100");
  });
});
