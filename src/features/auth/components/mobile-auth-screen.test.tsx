import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileAuthScreen } from "@/features/auth/components/mobile-auth-screen";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/components/google-sign-in-button", () => ({
  GoogleSignInButton: ({ nextPath }: { nextPath: string }) => (
    <output data-testid="google-login-next-path">{nextPath}</output>
  ),
}));

describe("MobileAuthScreen", () => {
  it("sends returning Google sign-ins through language refresh before the offer/tutorial flow", () => {
    render(
      <LocaleProvider initialLocale="en">
        <MobileAuthScreen />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("google-login-next-path")).toHaveTextContent(
      "/?mobileLanguageRefresh=1&showOffer=1",
    );
  });
});
