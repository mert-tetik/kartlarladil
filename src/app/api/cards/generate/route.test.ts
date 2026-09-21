/**
 * @vitest-environment node
 */

import { LOCALE_CODES } from "@/data/languages";
import { POST } from "@/app/api/cards/generate/route";
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
  const translations = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "dinlemek"]));
  const definitions = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "Sesleri dikkatle duymak"]));

  return {
    language: "ru",
    tier: "A2",
    termKind: "word",
    term: "слушать",
    partOfSpeech: "verb",
    pronunciation: "slushat",
    translations,
    example: "Я люблю слушать музыку.",
    exampleTranslation: "Müzik dinlemeyi severim.",
    definitions,
    grammar: ["The infinitive ends in -ать."],
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
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
