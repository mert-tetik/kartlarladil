import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "@/features/auth/components/password-input";

describe("PasswordInput", () => {
  it("toggles password visibility", async () => {
    const user = userEvent.setup();

    render(
      <label>
        Şifre
        <PasswordInput name="password" />
      </label>,
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
