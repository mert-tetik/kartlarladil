"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Languages,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  SendHorizonal,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLanguagePicker } from "@/components/inline-language-picker";
import { AudioVisualizer } from "@/features/ai-practice/components/audio-visualizer";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { getSpeechLanguage, speakText } from "@/features/cards/card-speech";

import { useLocale, useT } from "@/i18n/locale-provider";
import { cn, createId } from "@/lib/utils";
import type { LanguageCode, LimitErrorCode, LocaleCode } from "@/types/domain";

type TranslationStatus = "idle" | "loading" | "ready" | "error";

interface ClientMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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

export function AskChatPanel({
  language,
  initialTerm,
}: {
  language: LanguageCode;
  initialTerm: string;
}) {
  const t = useT();
  const { locale: currentLocale } = useLocale();


  const [messages, setMessages] = useState<ClientMessage[]>([]);
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
  const initialSentRef = useRef(false);

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
    const frameId = window.requestAnimationFrame(() => {
      const list = listRef.current;

      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messages]);

  useEffect(() => {
    if (!initialTerm || initialSentRef.current || pending) {
      return;
    }

    initialSentRef.current = true;
    void submitContent(t("ask.initialPrompt", { term: initialTerm }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTerm, pending, t]);

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
      id: createId("ask-user"),
      role: "user",
      content,
    };
    const assistantMessage: ClientMessage = {
      id: createId("ask-assistant"),
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
      const response = await fetch("/api/ask/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          locale: currentLocale,
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
        replaceAssistantMessage(assistantMessage.id, t("ask.emptyResponse"));
      }
    } catch {
      replaceAssistantMessage(assistantMessage.id, t("ask.error"));
    } finally {
      setPending(false);
      textareaRef.current?.focus();
    }
  }

  async function translateMessage(message: ClientMessage) {
    if (!message.content.trim()) {
      return;
    }

    if (
      message.translation?.status === "loading" ||
      (message.translation?.status === "ready" && message.translation.requestedLocale === currentLocale)
    ) {
      return;
    }

    updateMessageTranslation(message.id, { status: "loading", requestedLocale: currentLocale });

    try {
      const response = await fetch("/api/ai-practice/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          targetLocale: currentLocale,
          text: message.content,
        }),
      });

      if (!response.ok) {
        updateMessageTranslation(message.id, { status: "error", requestedLocale: currentLocale });
        return;
      }

      const payload = (await response.json()) as { translation?: unknown; targetLocale?: unknown };
      const translation = typeof payload.translation === "string" ? payload.translation.trim() : "";
      const targetLocale = typeof payload.targetLocale === "string" ? (payload.targetLocale as LocaleCode) : currentLocale;

      if (!translation) {
        updateMessageTranslation(message.id, { status: "error", requestedLocale: currentLocale });
        return;
      }

      updateMessageTranslation(message.id, {
        status: "ready",
        text: translation,
        requestedLocale: currentLocale,
        targetLocale,
      });
    } catch {
      updateMessageTranslation(message.id, { status: "error", requestedLocale: currentLocale });
    }
  }

  function updateMessageTranslation(messageId: string, translation: ClientMessage["translation"]) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, translation } : message)),
    );
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
    <section className="mx-auto flex h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] min-h-0 max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background-card">
      <ChatHeader
        language={language}
        canReset={!pending && messages.length > 0}
        onReset={() => {
          initialSentRef.current = true;
          setMessages([]);
        }}
      />
      <MessageList
        refObject={listRef}
        messages={messages}
        pending={pending}
        onTranslate={translateMessage}
        onSpeak={handleSpeakMessage}
      />
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
      />

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
  language,
  canReset,
  onReset,
}: {
  language: LanguageCode;
  canReset: boolean;
  onReset: () => void;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-background-muted">
          <Image src="/logo.png" alt="FoxiesDeck" fill sizes="48px" className="object-contain p-1" priority />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{t("page.ask.title")}</h1>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm">
            <InlineLanguagePicker
              value={language}
              onChange={(code) => router.push(`/ask/${code}`)}
            />
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={!canReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("ask.reset")}
        </Button>
      </div>
    </header>
  );
}

function MessageList({
  refObject,
  messages,
  pending,
  onTranslate,
  onSpeak,
}: {
  refObject: RefObject<HTMLDivElement | null>;
  messages: ClientMessage[];
  pending: boolean;
  onTranslate: (message: ClientMessage) => void;
  onSpeak: (message: ClientMessage) => void;
}) {
  const t = useT();

  return (
    <div ref={refObject} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" data-ask-chat-scroll="true">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center text-center">
          <div className="relative size-24 overflow-hidden rounded-full bg-background-muted">
            <Image src="/logo.png" alt="" fill sizes="96px" className="object-contain p-2" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">{t("page.ask.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-foreground-secondary">{t("page.ask.description")}</p>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
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
  pending,
  onTranslate,
  onSpeak,
}: {
  message: ClientMessage;
  pending: boolean;
  onTranslate: () => void;
  onSpeak: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex gap-3 animate-message-pop", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="relative mt-1 size-8 shrink-0 overflow-hidden rounded-full bg-background-muted sm:size-9">
          <Image src="/logo.png" alt="" fill sizes="36px" className="object-contain p-1" />
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
        aria-label={t("ask.translate")}
        title={t("ask.translate")}
        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {isTranslating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Languages className="size-4" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={onSpeak}
        aria-label={t("ask.speakMessage")}
        title={t("ask.speakMessage")}
        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Volume2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function TranslationView({ translation }: { translation?: ClientMessage["translation"] }) {
  const t = useT();

  if (!translation || translation.status === "idle") {
    return null;
  }

  if (translation.status === "loading") {
    return <p className="mt-1.5 text-xs text-foreground-muted">{t("ask.translating")}</p>;
  }

  if (translation.status === "error") {
    return <p className="mt-1.5 text-xs text-rose-600">{t("ask.translationError")}</p>;
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
}) {
  const t = useT();
  const micLabel = microphoneSupported
    ? isRecording
      ? t("ask.stopMic")
      : t("ask.startMic")
    : t("ask.micUnsupported");

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-border p-3 sm:p-4">
      <div
        className={cn(
          "flex gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-foreground",
          isRecording ? "items-center" : "items-end",
        )}
      >
        {isRecording ? (
          <div className="flex min-h-10 flex-1 items-center px-2">
            <AudioVisualizer analyser={analyser} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={900}
            placeholder={t("ask.placeholder")}
            className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-foreground-muted"
            disabled={pending}
          />
        )}
        <Button
          type="button"
          size="icon"
          variant={isRecording ? "danger" : "secondary"}
          onClick={onToggleRecording}
          disabled={pending || !microphoneSupported}
          aria-label={micLabel}
          title={micLabel}
        >
          {isRecording ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
        </Button>
        {!isRecording ? (
          <Button type="submit" size="icon" disabled={pending || draft.trim().length === 0} aria-label={t("ask.send")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizonal className="size-4" aria-hidden="true" />}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-foreground-muted">{t("ask.privacy")}</p>
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
    return t("ask.loginRequired");
  }

  if (errorCode === "not_configured") {
    return t("ask.notConfigured");
  }

  if (errorCode === "invalid_request") {
    return t("ask.invalidRequest");
  }

  if (errorCode === "ai_daily_limit" || errorCode === "ai_monthly_limit") {
    return t("ask.limitReached");
  }

  return t("ask.error");
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
