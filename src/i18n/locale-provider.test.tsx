import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY } from "@/i18n/config";
import { LocaleProvider, useLocale } from "@/i18n/locale-provider";

const refreshMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const backMock = vi.hoisted(() => vi.fn());
const forwardMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: pushMock,
    replace: replaceMock,
    back: backMock,
    forward: forwardMock,
  }),
}));

function LocaleProbe() {
  const { locale, setLocale } = useLocale();

  return (
    <>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale("de")}>
        Set German
      </button>
    </>
  );
}

function clearLocaleCookie() {
  document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

beforeEach(() => {
  window.localStorage.clear();
  clearLocaleCookie();
  refreshMock.mockClear();
  pushMock.mockClear();
  replaceMock.mockClear();
  backMock.mockClear();
  forwardMock.mockClear();
});

describe("LocaleProvider", () => {
  it("syncs stored locale on mount without refreshing the route", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "tr");

    render(
      <LocaleProvider initialLocale="en">
        <LocaleProbe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("tr");
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("tr");
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=tr`);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes the route when locale changes through setLocale", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="en">
        <LocaleProbe />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Set German" }));

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("de");
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("de");
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=de`);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
