import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GoogleSignInButton,
  setNativeTwaFormField,
} from "@/features/auth/components/google-sign-in-button";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  signInWithGoogleAction: vi.fn(async () => ({ status: "idle", message: "" })),
}));

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    delete window.FoxiesDeckNativeBilling;
  });

  it("marks the request as native only when the Android bridge is present", () => {
    render(
      <LocaleProvider initialLocale="en">
        <GoogleSignInButton label="Sign in with Google" nextPath="/" showConsent={false} />
      </LocaleProvider>,
    );

    const form = screen.getByRole("button", { name: "Sign in with Google" }).closest("form");
    const nativeTwaField = form?.querySelector<HTMLInputElement>('input[name="nativeTwa"]');
    expect(nativeTwaField).toHaveValue("0");

    window.FoxiesDeckNativeBilling = {
      getDetails: () => "{}",
      listPurchases: () => "[]",
      purchase: () => "{}",
    };
    setNativeTwaFormField(form as HTMLFormElement, window.FoxiesDeckNativeBilling);

    expect(nativeTwaField).toHaveValue("1");
  });
});
