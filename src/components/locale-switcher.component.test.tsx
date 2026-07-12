import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LANDING_CARD_LANGUAGE_KEY,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LocaleProvider, useLocale } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
}));

function LocaleProbe() {
  const { locale } = useLocale();
  return <output aria-label="current locale">{locale}</output>;
}

describe("LocaleSwitcher language matching", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers to swap languages when the navbar locale matches the card language", async () => {
    const user = userEvent.setup();
    writeLandingCardLanguage("en", { notify: false });

    render(
      <LocaleProvider initialLocale="tr">
        <LocaleSwitcher navbar />
        <LocaleProbe />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Site dilini değiştir" }));
    await user.click(screen.getByRole("option", { name: /English/i }));

    const swapButton = screen.getByRole("button", { name: "Dillerin yerlerini değiştir" });
    expect(swapButton).toBeInTheDocument();

    await user.click(swapButton);

    expect(screen.getByLabelText("current locale")).toHaveTextContent("en");
    expect(window.localStorage.getItem(LANDING_CARD_LANGUAGE_KEY)).toBe("tr");
  });
});
