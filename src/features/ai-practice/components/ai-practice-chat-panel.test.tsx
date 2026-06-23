/* eslint-disable @next/next/no-img-element */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { AiPracticeChatPanel } from "@/features/ai-practice/components/ai-practice-chat-panel";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";

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

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({ refreshStats: vi.fn() }),
}));

const testCharacter = getAiPracticeCharacters()[0]!;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

describe("AiPracticeChatPanel", () => {
  it("keeps messages in a fixed scroll area with avatars and message actions", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("fetch", makeFetchMock({ chatText: "hey, nice to meet you" }));

    const { container } = renderPanel();

    expect(container.querySelector('[data-ai-chat-scroll="true"]')).toHaveClass("overflow-y-auto");

    await sendMessage(user, "hello");

    expect(await screen.findByText("hey, nice to meet you")).toBeVisible();
    expect(screen.getAllByAltText("Clara").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "Translate" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "Speak message" }).length).toBeGreaterThanOrEqual(2);
  });

  it("translates a message once and reuses the cached translation", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock({ chatText: "how are you", translation: "nasılsın" });

    vi.stubGlobal("fetch", fetchMock);

    renderPanel();
    await sendMessage(user, "hello");
    await screen.findByText("how are you");

    const translateButton = screen.getAllByRole("button", { name: "Translate" })[1]!;

    await user.click(translateButton);
    expect(await screen.findByText("nasılsın")).toBeVisible();

    await user.click(translateButton);

    const translateCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/ai-practice/translate"));

    expect(translateCalls).toHaveLength(1);
  });

  it("speaks a message with the practice language", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    const cancel = vi.fn();

    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(public text: string) {}
    }

    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      cancel,
      getVoices: vi.fn(() => [{ lang: "en-US" }]),
      speak,
    });
    vi.stubGlobal("fetch", makeFetchMock({ chatText: "hi there" }));

    renderPanel();
    await sendMessage(user, "hello");
    await screen.findByText("hi there");
    await user.click(screen.getAllByRole("button", { name: "Speak message" })[2]!);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);

    const utterance = speak.mock.calls[0]![0] as SpeechSynthesisUtterance;

    expect(utterance.text).toBe("hi there");
    expect(utterance.lang).toBe("en-US");
  });

  it("sends final microphone transcript as a message", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock({ chatText: "voice answer" });
    const recognition = installSpeechRecognitionMock();

    vi.stubGlobal("fetch", fetchMock);

    renderPanel();

    await waitFor(() => expect(screen.getByRole("button", { name: "Start microphone" })).toBeEnabled());
    const micButton = screen.getByRole("button", { name: "Start microphone" });
    await user.click(micButton);

    expect(recognition.instance?.start).toHaveBeenCalledTimes(1);

    act(() => {
      recognition.instance?.onresult?.(makeSpeechResultEvent("spoken hello"));
    });

    await user.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(await screen.findByText("spoken hello")).toBeVisible();
    expect(await screen.findByText("voice answer")).toBeVisible();
  });

  it("shows a score badge and plays a sound when the message earns points", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("fetch", makeFetchMock({ chatText: "great answer", score: 5 }));

    renderPanel();
    await sendMessage(user, "hello");

    expect(await screen.findByText("great answer")).toBeVisible();
    expect(await screen.findByText("Nice Answer!")).toBeVisible();
    expect(playSoundEffect).toHaveBeenCalledWith("points");
  });

  it("keeps the composer docked at the bottom when the mobile viewport shrinks without focus", () => {
    const keyboard = installMobileKeyboardEnvironment({ viewportHeight: 844 });

    const { container } = renderPanel();
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

  it("fixes the composer above the keyboard when the textarea is focused on mobile", () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });

    const keyboard = installMobileKeyboardEnvironment({ viewportHeight: 844 });

    const { container } = renderPanel();
    const composer = container.querySelector('[data-chat-composer]') as HTMLFormElement;
    const textarea = screen.getByPlaceholderText("Write your message...");

    fireEvent.focus(textarea);

    act(() => {
      keyboard.setViewportHeight(500);
    });

    expect(composer).toHaveClass("fixed");
    expect(composer.style.bottom).toBe(`${844 - 500}px`);
    expect(composer.style.top).toBe("");
    expect(composer.style.transform).toBe("");
  });
});

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en">
      <AiPracticeChatPanel character={testCharacter} language="en" />
    </LocaleProvider>,
  );
}

async function sendMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText("Write your message..."), text);
  await user.click(screen.getByRole("button", { name: "Send message" }));
}

function makeFetchMock({
  chatText,
  translation = "translated text",
  score = 0,
}: {
  chatText: string;
  translation?: string;
  score?: number;
}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/ai-practice/translate")) {
      return Promise.resolve(Response.json({ translation, targetLocale: "tr" }));
    }

    if (url.includes("/api/ai-practice/score")) {
      return Promise.resolve(Response.json({ points: score }));
    }

    return Promise.resolve(new Response(chatText));
  });
}

function installSpeechRecognitionMock() {
  const recognition: {
    instance: MockSpeechRecognition | null;
  } = { instance: null };

  class MockSpeechRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onresult: ((event: ReturnType<typeof makeSpeechResultEvent>) => void) | null = null;
    start = vi.fn();
    stop = vi.fn(() => this.onend?.());

    constructor() {
      recognition.instance = this;
    }
  }

  vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);

  return recognition;
}

function makeSpeechResultEvent(transcript: string) {
  return {
    resultIndex: 0,
    results: [
      {
        0: { transcript },
        isFinal: true,
      },
    ],
  };
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
