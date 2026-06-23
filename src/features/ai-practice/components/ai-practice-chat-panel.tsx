"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, Languages, Loader2, Mic, Pause, SendHorizonal, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLanguagePicker } from "@/components/inline-language-picker";
import { getCharacterName, getRandomOpeningLine } from "@/features/ai-practice/ai-practice-data";
import { getSpeechLanguage, speakText } from "@/features/cards/card-speech";
import { AudioVisualizer } from "@/features/ai-practice/components/audio-visualizer";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { useProgressStats } from "@/features/progress/progress-client";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import { cn, createId } from "@/lib/utils";
import type {
  AiPracticeCharacter,
  AiPracticeMessage,
  LanguageCode,
  LimitErrorCode,
  LocaleCode,
  Tier,
} from "@/types/domain";

type TranslationStatus = "idle" | "loading" | "ready" | "error";

interface ClientMessage extends AiPracticeMessage {
  id: string;
  score?: number;
  translation?: {
    status: TranslationStatus;
    text?: string;
    requestedLocale?: LocaleCode;
    targetLocale?: LocaleCode;
  };
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort?: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}

export function AiPracticeChatPanel({
  character,
  language,
  tier = "A1",
}: {
  character: AiPracticeCharacter;
  language: LanguageCode;
  tier?: Tier;
}) {
  const [messages, setMessages] = useState<ClientMessage[]>(() => [
    {
      id: createId("ai-opening"),
      role: "assistant",
      content: getRandomOpeningLine(character, language),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [microphoneSupported, setMicrophoneSupported] = useState(false);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");
  const shouldSendTranscriptRef = useRef(false);
  const { locale } = useLocale();
  const t = useT();
  const { refreshStats } = useProgressStats();
  const { keyboardHeight, safeAreaBottom, navHeight } = useVisualViewport();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const composerWrapperRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const panelBottom = keyboardHeight > 0 ? keyboardHeight : navHeight + safeAreaBottom;
  const messageListBottomPadding = isMobileViewport ? composerHeight + panelBottom : 80;
  const characterName = getCharacterName(character, language);
  const languageName = getLanguageDisplayName(language, locale);

  const scrollMessageListToBottom = useCallback(() => {
    const list = listRef.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMicrophoneSupported(Boolean(getSpeechRecognitionConstructor()));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      recognitionRef.current?.abort?.();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    function updateMobile() {
      setIsMobileViewport(mediaQuery.matches);
    }
    updateMobile();
    mediaQuery.addEventListener("change", updateMobile);
    return () => mediaQuery.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => {
    const wrapper = composerWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize && entry.borderBoxSize.length > 0
            ? entry.borderBoxSize[0].blockSize
            : entry.contentRect.height;
        setComposerHeight(height);
      }
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollMessageListToBottom();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messages, scrollMessageListToBottom]);

  useEffect(() => {
    function handleResize() {
      scrollMessageListToBottom();
    }

    const viewport = window.visualViewport;
    if (!viewport) return;
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, [scrollMessageListToBottom]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await submitContent(draft);
  }

  async function submitContent(rawContent: string) {
    const content = rawContent.trim();

    if (!content || pending) {
      return;
    }

    const userMessage: ClientMessage = {
      id: createId("ai-user"),
      role: "user",
      content,
    };
    const assistantMessage: ClientMessage = {
      id: createId("ai-assistant"),
      role: "assistant",
      content: "",
    };
    const requestMessages = messages
      .filter((message) => message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setInterimTranscript("");
    setPending(true);

    try {
      const response = await fetch("/api/ai-practice/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          characterId: character.id,
          tier,
          messages: [...requestMessages, { role: userMessage.role, content: userMessage.content }],
        }),
      });

      if (!response.ok || !response.body) {
        const errorCode = await readErrorCode(response);

        if (errorCode === "ai_daily_limit" || errorCode === "ai_monthly_limit") {
          setLimitError(errorCode);
          setMessages((current) => current.filter((message) => message.id !== assistantMessage.id));
          return;
        }

        replaceAssistantMessage(assistantMessage.id, getLocalizedErrorMessage(errorCode, t));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        streamedText += decoder.decode(value, { stream: true });
        replaceAssistantMessage(assistantMessage.id, streamedText);
      }

      streamedText += decoder.decode();

      if (streamedText.trim().length === 0) {
        replaceAssistantMessage(assistantMessage.id, t("aiPractice.chat.emptyResponse"));
      } else {
        await scoreUserMessage(userMessage, streamedText);
      }
    } catch {
      replaceAssistantMessage(assistantMessage.id, t("aiPractice.chat.error"));
    } finally {
      setPending(false);
      textareaRef.current?.focus();
    }
  }

  async function scoreUserMessage(userMessage: ClientMessage, assistantText: string) {
    try {
      const response = await fetch("/api/ai-practice/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          characterId: character.id,
          userMessage: userMessage.content,
          assistantMessage: assistantText,
        }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { points?: unknown };
      const points = Number(payload.points);

      if (points !== 5 && points !== 10) {
        return;
      }

      updateMessageScore(userMessage.id, points);
      playSoundEffect("points");
      void refreshStats();
    } catch {
      // Scoring is best-effort; never block the chat flow.
    }
  }

  function updateMessageScore(messageId: string, score: number) {
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, score } : message)));
  }

  async function translateMessage(message: ClientMessage) {
    if (!message.content.trim()) {
      return;
    }

    if (
      message.translation?.status === "loading" ||
      (message.translation?.status === "ready" && message.translation.requestedLocale === locale)
    ) {
      return;
    }

    updateMessageTranslation(message.id, { status: "loading", requestedLocale: locale });

    try {
      const response = await fetch("/api/ai-practice/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          targetLocale: locale,
          text: message.content,
        }),
      });

      if (!response.ok) {
        updateMessageTranslation(message.id, { status: "error", requestedLocale: locale });
        return;
      }

      const payload = (await response.json()) as { translation?: unknown; targetLocale?: unknown };
      const translation = typeof payload.translation === "string" ? payload.translation.trim() : "";
      const targetLocale = typeof payload.targetLocale === "string" ? (payload.targetLocale as LocaleCode) : locale;

      if (!translation) {
        updateMessageTranslation(message.id, { status: "error", requestedLocale: locale });
        return;
      }

      updateMessageTranslation(message.id, {
        status: "ready",
        text: translation,
        requestedLocale: locale,
        targetLocale,
      });
    } catch {
      updateMessageTranslation(message.id, { status: "error", requestedLocale: locale });
    }
  }

  function updateMessageTranslation(messageId: string, translation: ClientMessage["translation"]) {
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, translation } : message)));
  }

  function replaceAssistantMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, content } : message)),
    );
  }

  function handleSpeakMessage(message: ClientMessage) {
    speakText(message.content, language);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitContent(draft);
  }

  function toggleRecording() {
    if (isRecording) {
      shouldSendTranscriptRef.current = true;
      recognitionRef.current?.stop();
      stopAudioVisualizer();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition || pending) {
      return;
    }

    const recognition = new SpeechRecognition();

    finalTranscriptRef.current = "";
    shouldSendTranscriptRef.current = true;
    setDraft("");
    setInterimTranscript("");

    recognition.lang = getSpeechLanguage(language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = getTranscriptFromSpeechResult(result);

        if (!transcript) {
          continue;
        }

        if (result?.isFinal) {
          final = `${final} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      if (final) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${final}`.trim();
      }

      setInterimTranscript(interim || finalTranscriptRef.current);
    };
    recognition.onerror = () => {
      shouldSendTranscriptRef.current = false;
      setIsRecording(false);
      setInterimTranscript("");
      recognitionRef.current = null;
      stopAudioVisualizer();
    };
    recognition.onend = () => {
      const transcript = finalTranscriptRef.current.trim();
      const shouldSend = shouldSendTranscriptRef.current;

      setIsRecording(false);
      setInterimTranscript("");
      recognitionRef.current = null;
      stopAudioVisualizer();

      if (shouldSend && transcript) {
        void submitContent(transcript);
      }
    };

    recognitionRef.current = recognition;
    setIsRecording(true);

    try {
      recognition.start();
      void startAudioVisualizer();
    } catch {
      shouldSendTranscriptRef.current = false;
      setIsRecording(false);
      recognitionRef.current = null;
      stopAudioVisualizer();
    }
  }

  async function startAudioVisualizer() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch {
      // Ignore visualizer errors; speech recognition can still work.
    }
  }

  function stopAudioVisualizer() {
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }

  return (
    <section className="relative mx-auto flex h-full max-h-full min-h-0 max-w-5xl flex-col rounded-lg border border-border bg-background-card max-lg:rounded-none max-lg:border-x-0">
      <ChatHeader
        character={character}
        characterName={characterName}
        language={language}
        tier={tier}
      />
      <MessageList
        refObject={listRef}
        messages={messages}
        character={character}
        characterName={characterName}
        languageName={languageName}
        pending={pending}
        onTranslate={translateMessage}
        onSpeak={handleSpeakMessage}
        bottomPadding={messageListBottomPadding}
      />
      <div
        ref={composerWrapperRef}
        className="max-lg:fixed max-lg:left-0 max-lg:right-0 max-lg:z-30 max-lg:border-t max-lg:border-border max-lg:bg-background-card lg:static"
        style={{ bottom: `${panelBottom}px` }}
      >
        <ChatComposer
          draft={isRecording && interimTranscript ? interimTranscript : draft}
          pending={pending}
          isRecording={isRecording}
          microphoneSupported={microphoneSupported}
          textareaRef={textareaRef}
          analyser={analyserRef.current}
          onChange={setDraft}
          onKeyDown={handleKeyDown}
          onSubmit={submitMessage}
          onToggleRecording={toggleRecording}
          onTextareaFocus={() => {
            scrollMessageListToBottom();
            if (textareaRef.current) {
              window.setTimeout(() => {
                textareaRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
              }, 0);
            }
          }}
        />
      </div>

      <UpgradeDialog
        open={limitError !== null}
        errorCode={limitError}
        onOpenChange={(open) => {
          if (!open) {
            setLimitError(null);
          }
        }}
      />
    </section>
  );
}

function ChatHeader({
  character,
  characterName,
  language,
  tier,
}: {
  character: AiPracticeCharacter;
  characterName: string;
  language: LanguageCode;
  tier: Tier;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <header className="relative flex shrink-0 items-center gap-3 border-b border-border p-3 pr-14 sm:p-4 sm:pr-16">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-background-muted">
        <Image src={character.imageSrc} alt={characterName} fill sizes="48px" className="object-cover" priority />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{characterName}</h1>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-foreground-muted">
          <InlineLanguagePicker
            value={language}
            onChange={(code) => router.push(`/ai-practice/${code}/${character.id}?tier=${tier}`)}
          />
          <span className="shrink-0 rounded bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground-secondary">
            {tier}
          </span>
        </p>
      </div>
      <Link
        href={`/ai-practice/${language}`}
        aria-label={t("aiPractice.chat.characters")}
        className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background-card text-foreground transition-colors hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Link>
    </header>
  );
}

function MessageList({
  refObject,
  messages,
  character,
  characterName,
  languageName,
  pending,
  onTranslate,
  onSpeak,
  bottomPadding,
}: {
  refObject: RefObject<HTMLDivElement | null>;
  messages: ClientMessage[];
  character: AiPracticeCharacter;
  characterName: string;
  languageName: string;
  pending: boolean;
  onTranslate: (message: ClientMessage) => void;
  onSpeak: (message: ClientMessage) => void;
  bottomPadding?: number;
}) {
  const t = useT();

  return (
    <div
      ref={refObject}
      className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5"
      style={(bottomPadding ?? 0) > 0 ? { paddingBottom: `${bottomPadding}px` } : undefined}
      data-ai-chat-scroll="true"
    >
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center text-center">
          <div className="relative size-24 overflow-hidden rounded-full bg-background-muted">
            <Image src={character.imageSrc} alt="" fill sizes="96px" className="object-cover" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">
            {t("aiPractice.chat.emptyTitle", { name: characterName })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-foreground-secondary">
            {t("aiPractice.chat.emptyDescription", { language: languageName })}
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              character={character}
              characterName={characterName}
              pending={pending && message.role === "assistant" && !message.content}
              onTranslate={() => onTranslate(message)}
              onSpeak={() => onSpeak(message)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatMessage({
  message,
  character,
  characterName,
  pending,
  onTranslate,
  onSpeak,
}: {
  message: ClientMessage;
  character: AiPracticeCharacter;
  characterName: string;
  pending: boolean;
  onTranslate: () => void;
  onSpeak: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex gap-3 animate-message-pop", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="relative mt-1 size-8 shrink-0 overflow-hidden rounded-lg bg-background-muted sm:size-9">
          <Image src={character.imageSrc} alt={characterName} fill sizes="36px" className="object-cover" />
        </div>
      )}
      <div className={cn("min-w-0 flex-1", isUser ? "items-end" : "items-start")}>
        <div className={cn("flex max-w-[86%] flex-col", isUser ? "ml-auto items-end" : "items-start")}>
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-sm leading-6",
              isUser ? "bg-background-inverse text-foreground-inverse" : "border border-border bg-background text-foreground",
            )}
          >
            {pending ? <Loader2 className="size-4 animate-spin text-foreground-muted" aria-hidden="true" /> : message.content}
          </div>
          {!pending && message.content ? (
            <>
              {isUser && message.score ? <ScoreBadge score={message.score} /> : null}
              <MessageActions message={message} onTranslate={onTranslate} onSpeak={onSpeak} />
              <TranslationView translation={message.translation} />
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MessageActions({
  message,
  onTranslate,
  onSpeak,
}: {
  message: ClientMessage;
  onTranslate: () => void;
  onSpeak: () => void;
}) {
  const t = useT();
  const isTranslating = message.translation?.status === "loading";

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-foreground-muted">
      <button
        type="button"
        onClick={onTranslate}
        disabled={isTranslating}
        aria-label={t("aiPractice.chat.translate")}
        title={t("aiPractice.chat.translate")}
        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {isTranslating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Languages className="size-4" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={onSpeak}
        aria-label={t("aiPractice.chat.speakMessage")}
        title={t("aiPractice.chat.speakMessage")}
        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Volume2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const t = useT();
  const label = score === 10 ? t("aiPractice.chat.perfectAnswer") : t("aiPractice.chat.niceAnswer");

  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600">
      <Coins className="size-3.5" aria-hidden="true" />
      <span>{label}</span>
      <span>+{score}</span>
    </div>
  );
}

function TranslationView({ translation }: { translation?: ClientMessage["translation"] }) {
  const t = useT();

  if (!translation || translation.status === "idle") {
    return null;
  }

  if (translation.status === "loading") {
    return <p className="mt-1.5 text-xs text-foreground-muted">{t("aiPractice.chat.translating")}</p>;
  }

  if (translation.status === "error") {
    return <p className="mt-1.5 text-xs text-rose-600">{t("aiPractice.chat.translationError")}</p>;
  }

  return (
    <p className="mt-2 rounded-md border border-border bg-background-card px-3 py-2 text-xs leading-5 text-foreground-secondary">
      {translation.text}
    </p>
  );
}

function ChatComposer({
  draft,
  pending,
  isRecording,
  microphoneSupported,
  textareaRef,
  analyser,
  onChange,
  onKeyDown,
  onSubmit,
  onToggleRecording,
  onTextareaFocus,
}: {
  draft: string;
  pending: boolean;
  isRecording: boolean;
  microphoneSupported: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  analyser: AnalyserNode | null;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleRecording: () => void;
  onTextareaFocus?: () => void;
}) {
  const t = useT();
  const micLabel = microphoneSupported
    ? isRecording
      ? t("aiPractice.chat.stopMic")
      : t("aiPractice.chat.startMic")
    : t("aiPractice.chat.micUnsupported");

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-border bg-background-card p-2 sm:p-3"
      data-chat-composer="bottom"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div
          className={cn(
            "flex gap-1.5 rounded-full border border-border bg-background p-1.5 focus-within:border-foreground",
            isRecording ? "items-center" : "items-end",
          )}
        >
          {isRecording ? (
            <div className="flex min-h-9 flex-1 items-center px-2">
              <AudioVisualizer analyser={analyser} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={onKeyDown}
              onFocus={onTextareaFocus}
              rows={1}
              maxLength={900}
              placeholder={t("aiPractice.chat.placeholder")}
              className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-foreground-muted"
              disabled={pending}
            />
          )}
          <button
            type="button"
            onClick={onToggleRecording}
            disabled={pending || !microphoneSupported}
            aria-label={micLabel}
            title={micLabel}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
              isRecording ? "text-rose-600 animate-pulse" : "text-foreground-muted hover:bg-background-muted hover:text-foreground",
            )}
          >
            {isRecording ? <Pause className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
          </button>
          {!isRecording ? (
            <Button
              type="submit"
              size="icon"
              disabled={pending || draft.trim().length === 0}
              aria-label={t("aiPractice.chat.send")}
              className="size-9 rounded-full bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizonal className="size-4" aria-hidden="true" />}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

async function readErrorCode(response: Response) {
  try {
    const payload = (await response.json()) as { errorCode?: unknown };
    return typeof payload.errorCode === "string" ? payload.errorCode : null;
  } catch {
    return null;
  }
}

function getLocalizedErrorMessage(errorCode: string | null, t: ReturnType<typeof useT>) {
  if (errorCode === "auth_required") {
    return t("aiPractice.chat.loginRequired");
  }

  if (errorCode === "not_configured") {
    return t("aiPractice.chat.notConfigured");
  }

  if (errorCode === "invalid_request" || errorCode === "unknown_character") {
    return t("aiPractice.chat.invalidRequest");
  }

  if (errorCode === "ai_daily_limit" || errorCode === "ai_monthly_limit") {
    return t("aiPractice.chat.limitReached");
  }

  return t("aiPractice.chat.error");
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function getTranscriptFromSpeechResult(result: SpeechRecognitionResultLike | undefined) {
  const firstAlternative = result?.[0];

  if (!firstAlternative) {
    return "";
  }

  return firstAlternative.transcript.trim();
}
