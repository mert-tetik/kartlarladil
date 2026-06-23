/* eslint-disable @next/next/no-img-element */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AskChatPanel } from "@/features/ask/components/ask-chat-panel";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

describe("AskChatPanel", () => {
  it("sends the initial term prompt automatically", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/ask/chat")) {
        return Promise.resolve(new Response("hello means a greeting in English."));
      }

      if (url.includes("/api/ai-practice/translate")) {
        return Promise.resolve(Response.json({ translation: "merhaba", targetLocale: "tr" }));
      }

      return Promise.resolve(new Response(""));
    });

    vi.stubGlobal("fetch", fetchMock);

    renderPanel({ initialTerm: "hello" });

    await waitFor(() => {
      expect(screen.getByText(/hello kelimesini bana anlat/)).toBeInTheDocument();
    });

    expect(await screen.findByText(/hello means a greeting/)).toBeVisible();

    const askCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/ask/chat"));
    expect(askCalls).toHaveLength(1);
  });

  it("allows the user to send a follow-up question", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    vi.stubGlobal("fetch", () => {
      callCount += 1;
      return Promise.resolve(new Response(`answer ${callCount}`));
    });

    renderPanel({ initialTerm: "" });

    const input = screen.getByPlaceholderText(/Bir/);
    await user.type(input, "give me a synonym");
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("answer 1")).toBeVisible();
  });

  it("keeps the composer docked at the bottom without fixed positioning when the viewport shrinks", () => {
    const keyboard = installMobileKeyboardEnvironment({ viewportHeight: 844 });

    const { container } = renderPanel({ initialTerm: "" });
    const composer = container.querySelector('[data-chat-composer]') as HTMLFormElement;

    expect(composer).toHaveAttribute("data-chat-composer", "bottom");

    act(() => {
      keyboard.setViewportHeight(500);
    });

    expect(composer).toHaveAttribute("data-chat-composer", "bottom");
    expect(composer).not.toHaveClass("fixed");
    expect(composer.style.top).toBe("");
    expect(composer.style.transform).toBe("");
  });
});

function renderPanel({ initialTerm }: { initialTerm: string }) {
  return render(
    <LocaleProvider initialLocale="tr">
      <AskChatPanel language="en" initialTerm={initialTerm} />
    </LocaleProvider>,
  );
}

function installMobileKeyboardEnvironment({
  innerHeight = 844,
  viewportHeight,
}: {
  innerHeight?: number;
  viewportHeight: number;
}) {
  const listeners = {
    resize: new Set<() => void>(),
    scroll: new Set<() => void>(),
  };
  const visualViewport = {
    height: viewportHeight,
    offsetTop: 0,
    addEventListener: vi.fn((event: "resize" | "scroll", listener: () => void) => {
      listeners[event].add(listener);
    }),
    removeEventListener: vi.fn((event: "resize" | "scroll", listener: () => void) => {
      listeners[event].delete(listener);
    }),
  };

  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "(max-width: 1023px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  });

  return {
    setViewportHeight(nextHeight: number) {
      visualViewport.height = nextHeight;
      listeners.resize.forEach((listener) => listener());
    },
  };
}
