import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CookieNotice } from "@/components/cookie-notice";
import { LocaleProvider } from "@/i18n/locale-provider";

const NOTICE_KEY = "foxiesdeck-cookie-notice-dismissed";

beforeEach(() => {
  window.localStorage.clear();
});

function renderNotice(locale: "tr" | "en" = "tr") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <CookieNotice />
    </LocaleProvider>,
  );
}

describe("CookieNotice", () => {
  it("shows the notice when not previously dismissed", async () => {
    renderNotice();

    await waitFor(() => {
      expect(screen.getByText(/gerekli çerezleri kullanır/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /çerez politikası/i })).toHaveAttribute("href", "/cookies");
    expect(screen.getByRole("button", { name: /anladım/i })).toBeInTheDocument();
  });

  it("does not show the notice when previously dismissed", async () => {
    window.localStorage.setItem(NOTICE_KEY, "true");
    renderNotice();

    await waitFor(() => {
      expect(screen.queryByText(/gerekli çerezleri kullanır/i)).not.toBeInTheDocument();
    });
  });

  it("hides the notice after accepting", async () => {
    const user = userEvent.setup();
    renderNotice();

    await waitFor(() => {
      expect(screen.getByText(/gerekli çerezleri kullanır/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /anladım/i }));

    await waitFor(() => {
      expect(screen.queryByText(/gerekli çerezleri kullanır/i)).not.toBeInTheDocument();
    });

    expect(window.localStorage.getItem(NOTICE_KEY)).toBe("true");
  });
});
