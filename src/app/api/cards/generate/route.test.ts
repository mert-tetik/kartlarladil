/**
 * @vitest-environment node
 */

import { POST } from "@/app/api/cards/generate/route";
import { createCardTestLocaleRecord } from "@/test/card-locale-samples";
import { vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());

vi.mock("openai", () => {
  class MockOpenAI {
    responses = { create: mockCreate };
  }

  return { __esModule: true, default: MockOpenAI, OpenAI: MockOpenAI };
});

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

function makeRequest(term = "sluşayu") {
  return new Request("http://localhost/api/cards/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      locale: "tr",
      term,
      targetLanguage: "ru",
      direction: "learning-to-native",
    }),
  });
}

function makeCardResponse() {
  const translations = createCardTestLocaleRecord();
  const definitions = createCardTestLocaleRecord();

  return {
    language: "ru",
    tier: "A2",
    termKind: "word",
    term: "слушать",
    partOfSpeech: "verb",
    pronunciation: "slushat",
    translations,
    examples: [
      { sentence: "Я люблю слушать музыку.", translation: "Müzik dinlemeyi severim." },
      { sentence: "Она будет слушать новую запись вечером.", translation: "Akşam yeni kaydı dinleyecek." },
    ],
    definitions,
    grammar: ["The infinitive ends in -ать."],
  };
}

function makeOpenAiResponse(card: ReturnType<typeof makeCardResponse>) {
  return {
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(card) }] }],
  };
}

describe("POST /api/cards/generate", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mockCreate.mockResolvedValue({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(makeCardResponse()) }] }],
    });
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("generates a dictionary lemma for an inflected Russian transliteration", async () => {
    const response = await POST(makeRequest());
    const payload = (await response.json()) as { term?: string; language?: string };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ term: "слушать", language: "ru" });
    expect((payload as { examples?: unknown[] }).examples).toHaveLength(2);
    expect((payload as { example?: string }).example).toBe("Я люблю слушать музыку.");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries a generated card when its example ignores the target writing system", async () => {
    const invalidCard = makeCardResponse();
    invalidCard.examples[0]!.sentence = "I enjoy listening to music.";
    mockCreate
      .mockResolvedValueOnce(makeOpenAiResponse(invalidCard))
      .mockResolvedValueOnce(makeOpenAiResponse(makeCardResponse()));

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ language: "ru", term: makeCardResponse().term });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
