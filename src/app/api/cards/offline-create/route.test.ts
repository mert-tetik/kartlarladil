import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_CODES } from "@/data/languages";

const { createCustomCardActionMock, getCurrentAuthUserMock } = vi.hoisted(() => ({
  createCustomCardActionMock: vi.fn(),
  getCurrentAuthUserMock: vi.fn(),
}));

vi.mock("@/features/inventory/cloud-actions", () => ({
  createCustomCardAction: createCustomCardActionMock,
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: getCurrentAuthUserMock,
}));

import { POST } from "./route";

const localizedValues: Record<string, string> = {
  tr: "merhaba",
  en: "hello",
  de: "hallo",
  ru: "привет",
  fr: "bonjour",
  es: "hola",
  it: "ciao",
  pt: "olá",
  nl: "hallo",
  pl: "cześć",
  ar: "مرحبا",
  ja: "こんにちは",
  ko: "안녕",
  "zh-CN": "你好",
};

function validGeneratedCard() {
  return {
    language: "fr",
    tier: "A1",
    termKind: "word",
    term: "bonjour",
    partOfSpeech: "interjection",
    pronunciation: "bonjur",
    translations: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, localizedValues[locale]])),
    examples: [
      { sentence: "Bonjour tout le monde.", translation: "Hello everyone." },
      { sentence: "Je vous remercie.", translation: "Thank you." },
    ],
    definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, localizedValues[locale]])),
    grammar: [],
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/cards/offline-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cards/offline-create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates generated cards before calling the existing subscription-aware creator", async () => {
    const response = await POST(makeRequest({ term: "bonjour" }));

    expect(response.status).toBe(400);
    expect(createCustomCardActionMock).not.toHaveBeenCalled();
  });

  it("maps generated card data into the existing custom-card creation flow", async () => {
    createCustomCardActionMock.mockResolvedValue({
      status: "success",
      message: "",
      data: { card: { cardId: "custom-card" }, vocabularyCard: {} },
    });

    const response = await POST(makeRequest(validGeneratedCard()));

    expect(response.status).toBe(200);
    expect(createCustomCardActionMock).toHaveBeenCalledWith(expect.objectContaining({
      language: "fr",
      tier: "A1",
      termKind: "word",
      draft: expect.objectContaining({
        term: "bonjour",
        examples: [
          { example: "Bonjour tout le monde.", translation: "Hello everyone." },
          { example: "Je vous remercie.", translation: "Thank you." },
        ],
      }),
    }));
  });

  it("passes a validated retry key through for idempotent offline sync", async () => {
    createCustomCardActionMock.mockResolvedValue({
      status: "success",
      message: "",
      data: { card: { cardId: "custom-card" }, vocabularyCard: {} },
    });

    const response = await POST(makeRequest({ ...validGeneratedCard(), idempotencyKey: "offline-draft-123" }));

    expect(response.status).toBe(200);
    expect(createCustomCardActionMock).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "offline-draft-123",
    }));
  });

  it("rejects malformed retry keys before creating a card", async () => {
    const response = await POST(makeRequest({ ...validGeneratedCard(), idempotencyKey: "bad key" }));

    expect(response.status).toBe(400);
    expect(createCustomCardActionMock).not.toHaveBeenCalled();
  });

  it("keeps subscription-limit failures as failures instead of reporting success", async () => {
    createCustomCardActionMock.mockResolvedValue({
      status: "error",
      message: "The active card limit has been reached.",
      errorCode: "free_active_card_limit",
    });

    const response = await POST(makeRequest(validGeneratedCard()));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.status).toBe("error");
    expect(payload.errorCode).toBe("free_active_card_limit");
  });

  it("returns an auth failure when the existing creator rejects an unsigned user", async () => {
    createCustomCardActionMock.mockResolvedValue({ status: "error", message: "Please sign in." });
    getCurrentAuthUserMock.mockResolvedValue(null);

    const response = await POST(makeRequest(validGeneratedCard()));

    expect(response.status).toBe(401);
  });
});
