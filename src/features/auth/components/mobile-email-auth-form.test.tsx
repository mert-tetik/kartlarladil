import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileEmailAuthForm } from "@/features/auth/components/mobile-email-auth-form";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/actions", () => ({
  loginAction: vi.fn(async () => ({ status: "idle", message: "" })),
  registerAction: vi.fn(async () => ({ status: "idle", message: "" })),
}));

describe("MobileEmailAuthForm", () => {
  it("keeps the register button locked until required fields are valid", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileEmailAuthForm
          authType="register"
          onBack={vi.fn()}
          onToggleAuthType={vi.fn()}
        />
      </LocaleProvider>,
    );

    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    const consentInput = document.querySelector('input[name="consent"]') as HTMLInputElement;

    expect(submitButton).toBeDisabled();

    fireEvent.input(emailInput, { target: { value: "test@example.com" } });
    fireEvent.input(passwordInput, { target: { value: "12345" } });
    fireEvent.click(consentInput);
    expect(submitButton).toBeDisabled();

    fireEvent.input(passwordInput, { target: { value: "123456" } });
    expect(submitButton).toBeEnabled();
  });
});
