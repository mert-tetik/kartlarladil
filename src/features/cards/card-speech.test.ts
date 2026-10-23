import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CARD_SPEECH_STATUS_EVENT,
  getSpeechLanguage,
  speakText,
  type CardSpeechStatusDetail,
} from "@/features/cards/card-speech";

describe("card speech", () => {
  afterEach(() => {
    delete window.FoxiesDeckNativeSpeech;
    delete window.FoxiesDeckNativeSpeechStatus;
    vi.unstubAllGlobals();
  });

  it("uses the native Android bridge when the app WebView provides it", () => {
    const speak = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak, stop: vi.fn() };

    expect(speakText("merhaba", "tr", { rate: 0.9 })).toBe(true);
    expect(speak).toHaveBeenCalledWith("merhaba", "tr-TR", 0.9);
  });

  it("forwards native TTS start and end callbacks to the UI", () => {
    const speakWithLifecycle = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak: vi.fn(() => true), speakWithLifecycle, stop: vi.fn() };
    const statuses: CardSpeechStatusDetail[] = [];
    const handleStatus = (event: Event) => statuses.push((event as CustomEvent<CardSpeechStatusDetail>).detail);
    window.addEventListener(CARD_SPEECH_STATUS_EVENT, handleStatus);

    expect(speakText("hola", "es")).toBe(true);
    const requestId = speakWithLifecycle.mock.calls[0]![3];
    window.FoxiesDeckNativeSpeechStatus?.(requestId, "start");
    window.FoxiesDeckNativeSpeechStatus?.(requestId, "end");

    expect(statuses.map(({ state }) => state)).toEqual(["start", "end"]);
    expect(statuses[0]).toMatchObject({ text: "hola", language: "es" });
    window.removeEventListener(CARD_SPEECH_STATUS_EVENT, handleStatus);
  });

  it("uses the stable language voice on native shells even for character profiles", () => {
    const speakWithProfile = vi.fn(() => true);
    const speak = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak, speakWithProfile, stop: vi.fn() };

    expect(speakText("merhaba", "tr", { rate: 0.9, voiceGender: "female", voiceAge: "young" })).toBe(true);
    expect(speak).toHaveBeenCalledWith("merhaba", "tr-TR", 0.9);
    expect(speakWithProfile).not.toHaveBeenCalled();
  });

  it("keeps compatibility with an older native shell", () => {
    const speak = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak, stop: vi.fn() };

    expect(speakText("merhaba", "tr", { voiceGender: "female" })).toBe(true);
    expect(speak).toHaveBeenCalledWith("merhaba", "tr-TR", 0.95);
  });

  it("falls back to browser speech when the native bridge rejects a request", () => {
    const nativeSpeak = vi.fn(() => false);
    const browserSpeak = vi.fn();
    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;

      constructor(public text: string) {}
    }

    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak: browserSpeak,
      resume: vi.fn(),
      cancel: vi.fn(),
    });
    window.FoxiesDeckNativeSpeech = { speak: nativeSpeak, stop: vi.fn() };

    expect(speakText("hello", "en")).toBe(true);
    expect(nativeSpeak).toHaveBeenCalledOnce();
    expect(browserSpeak).toHaveBeenCalledOnce();
  });

  it("does not enqueue empty speech requests", () => {
    const speak = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak, stop: vi.fn() };

    expect(speakText("   ", "en")).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });

  it("speaks immediately with only the stable language tag on mobile browsers", () => {
    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(public text: string) {}
    }

    const speak = vi.fn();
    const resume = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak,
      resume,
      cancel,
    });

    expect(speakText("hello", "en")).toBe(true);
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: "hello",
      lang: "en-US",
      rate: 0.95,
    });
    expect(speak.mock.calls[0]?.[0].voice).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("emits the browser speech start and end lifecycle", () => {
    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;

      constructor(public text: string) {}
    }

    const utterances: MockSpeechSynthesisUtterance[] = [];
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => utterances.push(utterance)),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const statuses: CardSpeechStatusDetail[] = [];
    const handleStatus = (event: Event) => statuses.push((event as CustomEvent<CardSpeechStatusDetail>).detail);
    window.addEventListener(CARD_SPEECH_STATUS_EVENT, handleStatus);

    expect(speakText("hello", "en")).toBe(true);
    utterances[0]!.onstart?.({} as SpeechSynthesisEvent);
    utterances[0]!.onend?.({} as SpeechSynthesisEvent);

    expect(statuses.map(({ state }) => state)).toEqual(["start", "end"]);
    expect(statuses[0]).toMatchObject({ text: "hello", language: "en" });
    window.removeEventListener(CARD_SPEECH_STATUS_EVENT, handleStatus);
  });

  it("retries browser speech rejected by mobile autoplay on the next gesture", () => {
    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(public text: string) {}
    }

    const utterances: MockSpeechSynthesisUtterance[] = [];
    const speak = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      utterances.push(utterance);
    });
    const resume = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak,
      resume,
      cancel,
    });

    expect(speakText("hello", "en")).toBe(true);
    expect(utterances).toHaveLength(1);
    utterances[0]!.onerror?.({ error: "not-allowed" } as SpeechSynthesisErrorEvent);

    fireEvent.pointerUp(window, { pointerType: "touch" });

    expect(speak).toHaveBeenCalledTimes(2);
    expect(utterances[1]).toMatchObject({ text: "hello", lang: "en-US", rate: 0.95 });
  });

  it("maps supported languages to stable BCP-47 speech tags", () => {
    expect(getSpeechLanguage("zh-CN")).toBe("zh-CN");
    expect(getSpeechLanguage("en")).toBe("en-US");
  });
});
