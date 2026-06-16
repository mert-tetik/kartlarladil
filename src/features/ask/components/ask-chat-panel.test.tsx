/* eslint-disable @next/next/no-img-element */
import { render, screen, waitFor } from "@testing-library/react";
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
});

describe("AskChatPanel", () => {
  it("sends the initial term prompt automatically", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
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

    const body = JSON.parse(String(askCalls[0]![1]?.body));
    expect(body.language).toBe("en");
    expect(body.locale).toBe("tr");
    expect(body.messages.at(-1).content).toMatch(/hello kelimesini bana anlat/);
  });

  it("allows the user to send a follow-up question", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    vi.stubGlobal("fetch", () => {
      callCount += 1;
      return Promise.resolve(new Response(`answer ${callCount}`));
    });

    renderPanel({ initialTerm: "" });

    const input = screen.getByPlaceholderText("Bir şey sor...");
    await user.type(input, "give me a synonym");
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("answer 1")).toBeVisible();
  });
});

function renderPanel({ initialTerm }: { initialTerm: string }) {
  return render(
    <LocaleProvider initialLocale="tr">
      <AskChatPanel language="en" initialTerm={initialTerm} />
    </LocaleProvider>,
  );
}
