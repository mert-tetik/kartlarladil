"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw, SendHorizonal } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { LanguageFlag } from "@/components/language-flag";
import { getCharacterName } from "@/features/ai-practice/ai-practice-data";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn, createId } from "@/lib/utils";
import type { AiPracticeCharacter, AiPracticeChatRole, AiPracticeMessage, LanguageCode } from "@/types/domain";

interface ClientMessage extends AiPracticeMessage {
  id: string;
}

export function AiPracticeChatPanel({
  character,
  language,
}: {
  character: AiPracticeCharacter;
  language: LanguageCode;
}) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { locale } = useLocale();
  const t = useT();
  const characterName = getCharacterName(character, language);
  const languageName = getLanguageDisplayName(language, locale);
  const requestMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages],
  );

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const content = draft.trim();

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
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, assistantMessage]);
    setDraft("");
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
          messages: [...requestMessages, { role: userMessage.role, content: userMessage.content }],
        }),
      });

      if (!response.ok || !response.body) {
        const errorCode = await readErrorCode(response);
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
      }
    } catch {
      replaceAssistantMessage(assistantMessage.id, t("aiPractice.chat.error"));
    } finally {
      setPending(false);
      textareaRef.current?.focus();
    }
  }

  function replaceAssistantMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, content } : message)),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitMessage();
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-5xl flex-col rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src={character.imageSrc}
              alt={characterName}
              fill
              sizes="56px"
              className="object-cover"
              priority
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-950">{characterName}</h1>
            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
              <LanguageFlag code={language} />
              <span className="truncate">{languageName}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/ai-practice/${language}`} className={buttonClassName("secondary", "sm")}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("aiPractice.chat.characters")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={pending || messages.length === 0}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("aiPractice.chat.reset")}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
            <div className="relative size-24 overflow-hidden rounded-lg bg-slate-100">
              <Image
                src={character.imageSrc}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">
              {t("aiPractice.chat.emptyTitle", { name: characterName })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("aiPractice.chat.emptyDescription", { language: languageName })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatBubble key={message.id} role={message.role} pending={pending && !message.content}>
                {message.content}
              </ChatBubble>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={submitMessage} className="border-t border-slate-200 p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 focus-within:border-slate-950">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={900}
            placeholder={t("aiPractice.chat.placeholder")}
            className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400"
            disabled={pending}
          />
          <Button type="submit" size="icon" disabled={pending || draft.trim().length === 0} aria-label={t("aiPractice.chat.send")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizonal className="size-4" aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t("aiPractice.chat.privacy")}</p>
      </form>
    </section>
  );
}

function ChatBubble({
  role,
  pending,
  children,
}: {
  role: AiPracticeChatRole;
  pending: boolean;
  children: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6",
          isUser ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-800",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden="true" /> : children}
      </div>
    </div>
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

  return t("aiPractice.chat.error");
}
