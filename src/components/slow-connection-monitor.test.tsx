import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { SlowConnectionMonitor } from "@/components/slow-connection-monitor";
import { ThemeProvider } from "@/components/theme-provider";

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

class MockPerformanceObserver {
  static lastInstance: MockPerformanceObserver | undefined;

  private readonly callback: (list: { getEntries: () => PerformanceEntry[] }) => void;

  constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
    this.callback = callback;
    MockPerformanceObserver.lastInstance = this;
  }

  observe = vi.fn();
  disconnect = vi.fn();

  emit(entries: PerformanceEntry[]) {
    this.callback({ getEntries: () => entries });
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
  usePathname: () => "/",
}));

function renderPrompt(locale: "en" | "tr" = "en") {
  window.history.replaceState({}, "", "/?visual=slow-connection");

  return render(
    <LocaleProvider initialLocale={locale}>
      <ThemeProvider initialTheme="default-dark">
        <SlowConnectionMonitor />
      </ThemeProvider>
    </LocaleProvider>,
  );
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
  routerMocks.push.mockClear();
  MockPerformanceObserver.lastInstance = undefined;
});

it("shows a centered, outline-free brand dialog with stacked rounded actions", async () => {
  renderPrompt();

  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.parentElement).toHaveClass("fixed", "z-[2147483000]", "place-items-center");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveClass("rounded-[28px]", "bg-brand", "text-center");
  expect(dialog).toHaveStyle({ color: "#000000" });
  expect(dialog).not.toHaveClass("border", "outline");
  expect(screen.getByRole("heading", { name: "Your internet connection is slow" })).toHaveClass("font-super-water");
  expect(screen.getByText(/Some parts of FoxiesDeck/)).toHaveClass("font-super-water", "text-center");

  const offlineButton = screen.getByRole("button", { name: "Switch to offline mode" });
  const continueButton = screen.getByRole("button", { name: "Keep using the app" });
  expect(offlineButton).toHaveClass("bg-white", "text-[#111827]", "rounded-full", "font-super-water", "outline-none", "focus-visible:outline-2");
  expect(continueButton).toHaveClass("bg-black", "text-white", "rounded-full", "font-super-water", "outline-none", "focus-visible:outline-white");
  expect(offlineButton.parentElement).toHaveClass("grid", "gap-3");
  expect(continueButton.parentElement).toBe(offlineButton.parentElement);
});

it("keeps the current route when the user chooses to continue", async () => {
  const user = userEvent.setup();
  renderPrompt();

  await user.click(await screen.findByRole("button", { name: "Keep using the app" }));

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(routerMocks.push).not.toHaveBeenCalled();
});

it("opens the existing offline screen and retains the current return route", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/card-draw?visual=slow-connection");
  render(
    <LocaleProvider initialLocale="en">
      <ThemeProvider initialTheme="default-dark">
        <SlowConnectionMonitor />
      </ThemeProvider>
    </LocaleProvider>,
  );

  await user.click(await screen.findByRole("button", { name: "Switch to offline mode" }));

  expect(routerMocks.push).toHaveBeenCalledWith("/offline?returnTo=%2Fcard-draw");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("lets Escape dismiss the prompt without navigating", async () => {
  renderPrompt();
  await screen.findByRole("alertdialog");

  fireEvent.keyDown(document, { key: "Escape" });

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(routerMocks.push).not.toHaveBeenCalled();
});

it("opens globally when the browser reports a 2g connection", async () => {
  window.history.replaceState({}, "", "/learn");
  const originalConnection = Object.getOwnPropertyDescriptor(navigator, "connection");
  const connection = new EventTarget();
  Object.defineProperty(connection, "effectiveType", { value: "2g" });
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
  });

  const view = render(
    <LocaleProvider initialLocale="en">
      <ThemeProvider initialTheme="default-dark">
        <SlowConnectionMonitor />
      </ThemeProvider>
    </LocaleProvider>,
  );

  try {
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  } finally {
    view.unmount();
    if (originalConnection) {
      Object.defineProperty(navigator, "connection", originalConnection);
    } else {
      Reflect.deleteProperty(navigator, "connection");
    }
  }
});

it("does not show the slow-connection prompt for a fast server 503", async () => {
  window.history.replaceState({}, "", "/learn");
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal("fetch", fetchMock);

  const view = render(
    <LocaleProvider initialLocale="en">
      <ThemeProvider initialTheme="default-dark">
        <SlowConnectionMonitor />
      </ThemeProvider>
    </LocaleProvider>,
  );

  try {
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  } finally {
    view.unmount();
    vi.unstubAllGlobals();
  }
});

it("uses repeated slow real asset transfers as a prompt signal", async () => {
  window.history.replaceState({}, "", "/learn");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);
  const view = render(
    <LocaleProvider initialLocale="en">
      <ThemeProvider initialTheme="default-dark">
        <SlowConnectionMonitor />
      </ThemeProvider>
    </LocaleProvider>,
  );

  try {
    await waitFor(() => expect(MockPerformanceObserver.lastInstance).not.toBeUndefined());
    const makeSlowAssetEntry = (name: string, startTime: number) => ({
      entryType: "resource",
      name,
      startTime,
      transferSize: 64 * 1_024,
      encodedBodySize: 64 * 1_024,
      responseStart: 100,
      responseEnd: 1_600,
    } as unknown as PerformanceResourceTiming);

    MockPerformanceObserver.lastInstance?.emit([
      makeSlowAssetEntry("https://cdn.example.test/first-image.webp", 10),
    ]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    MockPerformanceObserver.lastInstance?.emit([
      makeSlowAssetEntry("https://cdn.example.test/second-image.webp", 20),
    ]);
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  } finally {
    view.unmount();
    vi.unstubAllGlobals();
  }
});
