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
import {
  Coins,
  HelpCircle,
  Languages,
  Loader2,
  Mic,
  Pause,
  SendHorizonal,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypingIndicator } from "@/components/typing-indicator";
import { useAutoResizeTextarea } from "@/components/use-auto-resize-textarea";
import { getCharacterName } from "@/features/ai-practice/ai-practice-data";
import { getAiPracticeChatBackground, getAiPracticeScenarioChatBackground } from "@/features/ai-practice/ai-practice-chat-backgrounds";
import {
  getScenarioTitle,
  type AiPracticeScenario,
} from "@/features/ai-practice/ai-practice-scenarios";
import {
  parseAiPracticeScenarioHelpResponse,
  parseAiPracticeScenarioResponse,
  type ScenarioEvaluation,
} from "@/features/ai-practice/ai-practice-scenario-response";
import { getSpeechLanguage, speakText } from "@/features/cards/card-speech";
import { AudioVisualizer } from "@/features/ai-practice/components/audio-visualizer";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { useProgressStats } from "@/features/progress/progress-client";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { syncMissionsFromClientState } from "@/features/missions/mission-sync";
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

const CHAT_TIER_TEXT_CLASSES: Record<Tier, string> = {
  A1: "text-[var(--tier-a1-text)]",
  A2: "text-[var(--tier-a2-text)]",
  B1: "text-[var(--tier-b1-text)]",
  B2: "text-[var(--tier-b2-text)]",
  C1: "text-[var(--tier-c1-text)]",
};

interface ClientMessage extends AiPracticeMessage {
  id: string;
  score?: number;
  evaluation?: ScenarioEvaluation;
  helpSuggestions?: string[];
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
  initialOpeningLine,
  language,
  tier = "A1",
  scenario,
}: {
  character: AiPracticeCharacter;
  initialOpeningLine: string;
  language: LanguageCode;
  tier?: Tier;
  scenario?: AiPracticeScenario;
}) {
  const [messages, setMessages] = useState<ClientMessage[]>(() => [
    {
      id: createId("ai-opening"),
      role: "assistant",
      content: initialOpeningLine,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [microphoneSupported, setMicrophoneSupported] = useState(false);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const [evaluationFlashMessageId, setEvaluationFlashMessageId] = useState<string | null>(null);
  const [expandedEvaluationMessageId, setExpandedEvaluationMessageId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");
  const latestTranscriptRef = useRef("");
  const shouldSendTranscriptRef = useRef(false);
  const evaluationFlashTimerRef = useRef<number | null>(null);
  useAutoResizeTextarea(textareaRef, draft, !isRecording);
  const { locale } = useLocale();
  const t = useT();
  const { refreshStats } = useProgressStats();
  const characterName = getCharacterName(character, language);
  const languageName = getLanguageDisplayName(language, locale);
  const chatBackground = getAiPracticeChatBackground(character.id);
  const scenarioChatBackground = scenario ? getAiPracticeScenarioChatBackground(scenario.id) : null;
  const scenarioTitle = scenario ? getScenarioTitle(scenario, locale) : null;

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

  useEffect(() => {
    return () => {
      if (evaluationFlashTimerRef.current !== null) {
        window.clearTimeout(evaluationFlashTimerRef.current);
      }
    };
  }, []);

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
    setHelpOpen(false);
    setHelpError(false);
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
          mode: scenario ? "scenario" : "character",
          ...(scenario ? { scenarioId: scenario.id } : {}),
          uiLocale: locale,
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

      if (scenario) {
        const payload = parseAiPracticeScenarioResponse(JSON.stringify(await response.json().catch(() => null)));

        if (!payload) {
          replaceAssistantMessage(assistantMessage.id, t("aiPractice.chat.error"));
          return;
        }

        replaceAssistantMessage(assistantMessage.id, payload.reply);
        updateMessageEvaluation(userMessage.id, payload.evaluation);
        flashEvaluationLabel(userMessage.id);
        await scoreUserMessage(userMessage, payload.reply);
      } else {
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
      refreshLeaderboardPositions();
      void refreshStats();
      void syncMissionsFromClientState();
    } catch {
      // Scoring is best-effort; never block the chat flow.
    }
  }

  function updateMessageScore(messageId: string, score: number) {
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, score } : message)));
  }

  function updateMessageEvaluation(messageId: string, evaluation: ScenarioEvaluation) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, evaluation } : message)),
    );
  }

  function flashEvaluationLabel(messageId: string) {
    setEvaluationFlashMessageId(messageId);

    if (evaluationFlashTimerRef.current !== null) {
      window.clearTimeout(evaluationFlashTimerRef.current);
    }

    evaluationFlashTimerRef.current = window.setTimeout(() => {
      setEvaluationFlashMessageId((current) => (current === messageId ? null : current));
      evaluationFlashTimerRef.current = null;
    }, 2_000);
  }

  function updateMessageHelpSuggestions(messageId: string, suggestions: string[]) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, helpSuggestions: suggestions } : message)),
    );
  }

  async function requestScenarioHelp() {
    if (!scenario || pending) {
      return;
    }

    const latestUserMessage = getLatestUserMessage(messages);

    if (!latestUserMessage) {
      return;
    }

    setHelpOpen(true);
    setHelpError(false);

    if (latestUserMessage.helpSuggestions) {
      return;
    }

    setHelpLoading(true);

    try {
      const requestMessages = messages
        .filter((message) => message.content.trim().length > 0)
        .map((message) => ({ role: message.role, content: message.content }));
      const response = await fetch("/api/ai-practice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          characterId: character.id,
          mode: "scenario",
          scenarioId: scenario.id,
          requestType: "help",
          uiLocale: locale,
          tier,
          messages: requestMessages,
        }),
      });

      if (!response.ok) {
        setHelpError(true);
        return;
      }

      const payload = parseAiPracticeScenarioHelpResponse(JSON.stringify(await response.json().catch(() => null)));

      if (!payload) {
        setHelpError(true);
        return;
      }

      updateMessageHelpSuggestions(latestUserMessage.id, payload.suggestions);
    } catch {
      setHelpError(true);
    } finally {
      setHelpLoading(false);
    }
  }

  function selectHelpSuggestion(suggestion: string) {
    setDraft(suggestion);
    setHelpOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
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

  async function toggleRecording() {
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
    latestTranscriptRef.current = "";
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

      latestTranscriptRef.current = `${finalTranscriptRef.current} ${interim}`.trim();
      setInterimTranscript(latestTranscriptRef.current);
    };
    recognition.onerror = () => {
      shouldSendTranscriptRef.current = false;
      setIsRecording(false);
      setInterimTranscript("");
      latestTranscriptRef.current = "";
      recognitionRef.current = null;
      stopAudioVisualizer();
    };
    recognition.onend = () => {
      const transcript = (latestTranscriptRef.current || finalTranscriptRef.current).trim();
      const shouldSend = shouldSendTranscriptRef.current;

      setIsRecording(false);
      setInterimTranscript("");
      latestTranscriptRef.current = "";
      recognitionRef.current = null;
      stopAudioVisualizer();

      if (shouldSend && transcript) {
        void submitContent(transcript);
      }
    };

    recognitionRef.current = recognition;
    setIsRecording(true);

    try {
      await startAudioVisualizer();
      recognition.start();
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
    <section className="relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-background-card max-lg:rounded-none max-lg:border-x-0">
      {scenario && scenarioChatBackground ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          data-ai-scenario-background={scenario.id}
          style={{ backgroundImage: `${scenarioChatBackground.overlay}, url(${scenarioChatBackground.imageSrc})` }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `${chatBackground.overlay}, url(${chatBackground.imageSrc})` }}
        />
      )}
      <ChatHeader
        character={character}
        characterName={characterName}
        scenarioTitle={scenarioTitle}
        tier={tier}
      />
      <MessageList
        refObject={listRef}
        messages={messages}
        character={character}
        characterName={characterName}
        languageName={languageName}
        pending={pending}
        evaluationFlashMessageId={evaluationFlashMessageId}
        expandedEvaluationMessageId={expandedEvaluationMessageId}
        onTranslate={translateMessage}
        onSpeak={handleSpeakMessage}
        onToggleEvaluation={(messageId) => {
          setExpandedEvaluationMessageId((current) => (current === messageId ? null : messageId));
        }}
      />
      <div className="relative z-10 shrink-0 bg-background-card/85 backdrop-blur-sm">
        {scenario ? (
          <ScenarioHelpMenu
            latestUserMessage={getLatestUserMessage(messages)}
            open={helpOpen}
            loading={helpLoading}
            error={helpError}
            pending={pending}
            onToggle={() => {
              if (helpOpen) {
                setHelpOpen(false);
              } else {
                void requestScenarioHelp();
              }
            }}
            onSelectSuggestion={selectHelpSuggestion}
          />
        ) : null}
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
  scenarioTitle,
  tier,
}: {
  character: AiPracticeCharacter;
  characterName: string;
  scenarioTitle: string | null;
  tier: Tier;
}) {
  return (
    <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/15 bg-background-card/85 px-3 py-2 backdrop-blur-sm sm:px-4">
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-background-muted">
        <Image
          src={character.imageSrc}
          alt={characterName}
          fill
          sizes="36px"
          className="origin-top scale-[2] object-cover object-top"
          priority
        />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">{scenarioTitle ?? characterName}</h1>
        {scenarioTitle ? <p className="truncate text-[11px] text-foreground-muted">{characterName}</p> : null}
      </div>
      <span className={cn("shrink-0 text-xs font-bold", CHAT_TIER_TEXT_CLASSES[tier])}>
        {tier}
      </span>
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
  evaluationFlashMessageId,
  expandedEvaluationMessageId,
  onTranslate,
  onSpeak,
  onToggleEvaluation,
}: {
  refObject: RefObject<HTMLDivElement | null>;
  messages: ClientMessage[];
  character: AiPracticeCharacter;
  characterName: string;
  languageName: string;
  pending: boolean;
  evaluationFlashMessageId: string | null;
  expandedEvaluationMessageId: string | null;
  onTranslate: (message: ClientMessage) => void;
  onSpeak: (message: ClientMessage) => void;
  onToggleEvaluation: (messageId: string) => void;
}) {
  const t = useT();

  return (
    <div
      ref={refObject}
      className="relative z-10 min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto p-3 sm:p-5"
      data-ai-chat-scroll="true"
    >
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center text-center">
          <div className="relative size-24 overflow-hidden rounded-full bg-background-muted">
            <Image
              src={character.imageSrc}
              alt=""
              fill
              sizes="96px"
              className="origin-top scale-[2] object-cover object-top"
            />
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
              pending={pending && message.role === "assistant" && !message.content}
              evaluationFlashVisible={evaluationFlashMessageId === message.id}
              evaluationExpanded={expandedEvaluationMessageId === message.id}
              onTranslate={() => onTranslate(message)}
              onSpeak={() => onSpeak(message)}
              onToggleEvaluation={() => onToggleEvaluation(message.id)}
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
  evaluationFlashVisible,
  evaluationExpanded,
  onTranslate,
  onSpeak,
  onToggleEvaluation,
}: {
  message: ClientMessage;
  pending: boolean;
  evaluationFlashVisible: boolean;
  evaluationExpanded: boolean;
  onTranslate: () => void;
  onSpeak: () => void;
  onToggleEvaluation: () => void;
}) {
  const isUser = message.role === "user";
  const t = useT();

  return (
    <article className={cn("flex animate-message-pop", isUser ? "justify-end" : "justify-start")}>
      <div className="min-w-0 flex-1">
        <div className={cn("flex max-w-[86%] flex-col", isUser ? "ml-auto items-end" : "items-start")}>
          <div
            className={cn(
              "min-h-20 rounded-2xl px-5 py-4 text-sm leading-6",
              isUser
                ? "bg-background-inverse text-foreground-inverse"
                : "relative bg-white text-slate-950 shadow-sm whitespace-pre-wrap before:absolute before:-left-1.5 before:top-4 before:size-3 before:rotate-45 before:bg-white",
            )}
          >
            {pending ? <TypingIndicator label={t("common.loading")} /> : message.content}
          </div>
          {!pending && message.content ? (
            <>
              {isUser && message.score ? <ScoreBadge score={message.score} /> : null}
              {isUser && message.evaluation ? (
                <ScenarioEvaluationIndicator
                  evaluation={message.evaluation}
                  flashVisible={evaluationFlashVisible}
                  expanded={evaluationExpanded}
                  onToggle={onToggleEvaluation}
                />
              ) : null}
              <MessageActions message={message} onTranslate={onTranslate} onSpeak={onSpeak} />
              <TranslationView translation={message.translation} />
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const SCENARIO_EVALUATION_DOT_CLASSES: Record<ScenarioEvaluation["tier"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

const SCENARIO_EVALUATION_PANEL_CLASSES: Record<ScenarioEvaluation["tier"], string> = {
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  yellow: "border-amber-400/40 bg-amber-400/10 text-amber-950 dark:text-amber-100",
  red: "border-rose-400/40 bg-rose-500/10 text-rose-950 dark:text-rose-100",
};

function ScenarioEvaluationIndicator({
  evaluation,
  flashVisible,
  expanded,
  onToggle,
}: {
  evaluation: ScenarioEvaluation;
  flashVisible: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const labelKey = {
    green: "aiPractice.scenario.evaluation.green",
    yellow: "aiPractice.scenario.evaluation.yellow",
    red: "aiPractice.scenario.evaluation.red",
  } as const;

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5" data-scenario-evaluation={evaluation.tier}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap text-[11px] font-semibold transition-[max-width,opacity,transform] duration-300",
            flashVisible ? "max-w-40 translate-x-0 opacity-100" : "pointer-events-none max-w-0 translate-x-1 opacity-0",
            evaluation.tier === "green" && "text-emerald-500",
            evaluation.tier === "yellow" && "text-amber-500",
            evaluation.tier === "red" && "text-rose-500",
          )}
        >
          {t(labelKey[evaluation.tier])}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("aiPractice.scenario.evaluation.showDetails")}
          aria-expanded={expanded}
          className="inline-flex size-6 items-center justify-center rounded-full transition-transform duration-300 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span className={cn("size-3 rounded-full ring-2 ring-white/60", SCENARIO_EVALUATION_DOT_CLASSES[evaluation.tier])} />
        </button>
      </div>
      <div
        className={cn(
          "grid w-full max-w-[19rem] transition-[grid-template-rows,opacity,margin] duration-300",
          expanded ? "mt-0 grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={cn("rounded-xl border px-3 py-2 text-left text-xs leading-5", SCENARIO_EVALUATION_PANEL_CLASSES[evaluation.tier])}>
            <p>{evaluation.explanation}</p>
            <p className="mt-1.5 font-semibold">
              {t("aiPractice.scenario.evaluation.suggestedReply")}: <span className="font-normal">{evaluation.suggestedReply}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
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
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--score-start)]/10 px-2.5 py-1 text-xs font-bold text-[var(--score-start)]">
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

function ScenarioHelpMenu({
  latestUserMessage,
  open,
  loading,
  error,
  pending,
  onToggle,
  onSelectSuggestion,
}: {
  latestUserMessage: ClientMessage | null;
  open: boolean;
  loading: boolean;
  error: boolean;
  pending: boolean;
  onToggle: () => void;
  onSelectSuggestion: (suggestion: string) => void;
}) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const suggestions = latestUserMessage?.helpSuggestions ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle();
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onToggle();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onToggle, open]);

  return (
    <div ref={menuRef} className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
      {open ? (
        <div
          className="pointer-events-auto w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-background-card/95 p-2.5 shadow-md backdrop-blur-md"
          data-ai-scenario-help="menu"
          role="menu"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <p className="text-xs font-semibold text-foreground">{t("aiPractice.scenario.helpTitle")}</p>
            <button
              type="button"
              onClick={onToggle}
              aria-label={t("aiPractice.scenario.closeHelp")}
              className="inline-flex size-7 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl bg-background-muted px-3 py-2 text-xs text-foreground-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>{t("aiPractice.scenario.helpLoading")}</span>
            </div>
          ) : error ? (
            <p className="rounded-xl bg-background-muted px-3 py-2 text-xs text-foreground-muted">{t("aiPractice.scenario.helpError")}</p>
          ) : suggestions.length > 0 ? (
            <div className="grid gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  role="menuitem"
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="rounded-xl bg-background-muted px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-background-muted px-3 py-2 text-xs text-foreground-muted">{t("aiPractice.scenario.helpEmpty")}</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        disabled={!latestUserMessage || pending}
        aria-label={t("aiPractice.scenario.help")}
        aria-expanded={open}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-background-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        data-ai-scenario-help="button"
      >
        {open ? <X className="size-3.5" aria-hidden="true" /> : <HelpCircle className="size-3.5" aria-hidden="true" />}
        <span>{open ? t("aiPractice.scenario.closeHelp") : t("aiPractice.scenario.help")}</span>
      </button>
    </div>
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
      <div className="mx-auto w-full">
        <div
          className={cn(
            "flex gap-1.5 rounded-[25px] border border-border bg-background p-1.5 focus-within:border-foreground",
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
              className="max-h-[7.5rem] min-h-9 flex-1 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-foreground-muted"
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

function getLatestUserMessage(messages: ClientMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "user" && message.content.trim()) {
      return message;
    }
  }

  return null;
}

function getLocalizedErrorMessage(errorCode: string | null, t: ReturnType<typeof useT>) {
  if (errorCode === "auth_required") {
    return t("aiPractice.chat.loginRequired");
  }

  if (errorCode === "not_configured") {
    return t("aiPractice.chat.notConfigured");
  }

  if (errorCode === "invalid_request" || errorCode === "unknown_character" || errorCode === "unknown_scenario") {
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
