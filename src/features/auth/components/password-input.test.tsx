import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "@/features/auth/components/password-input";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PasswordInput", () => {
  it("toggles password visibility", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="tr">
        <label>
        Şifre
        <PasswordInput name="password" />
        </label>
      </LocaleProvider>,
    );

    const input = screen.getByLabelText("Şifre");
    const showButton = screen.getByRole("button", { name: "Şifreyi göster" });

    expect(input).toHaveAttribute("type", "password");

    await user.click(showButton);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Şifreyi gizle" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Şifreyi gizle" }));

    expect(input).toHaveAttribute("type", "password");
  });
});
