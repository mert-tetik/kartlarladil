/* eslint-disable @next/next/no-img-element */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { AiPracticeChatPanel } from "@/features/ai-practice/components/ai-practice-chat-panel";
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

const testCharacter = getAiPracticeCharacters()[0]!;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    await user.click(screen.getAllByRole("button", { name: "Speak message" })[1]!);

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
}: {
  chatText: string;
  translation?: string;
}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/ai-practice/translate")) {
      return Promise.resolve(Response.json({ translation, targetLocale: "tr" }));
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
