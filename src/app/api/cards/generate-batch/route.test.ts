/**
 * @vitest-environment node
 */

import { POST } from "@/app/api/cards/generate-batch/route";
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

function makeRequest() {
  return new Request("http://localhost/api/cards/generate-batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cards: [
        { locale: "en", term: "serendipity", targetLanguage: "en", direction: "learning-to-native" },
        { locale: "tr", term: "sobremesa", targetLanguage: "es", direction: "learning-to-native" },
      ],
    }),
  });
}

function makeCard(language: "en" | "es", term: string) {
  return {
    language,
    tier: "B1",
    termKind: "word",
    term,
    partOfSpeech: "noun",
    pronunciation: "or\u00e9nek",
    translations: createCardTestLocaleRecord(),
    examples: [
      { sentence: language === "es" ? `Me gusta ${term}.` : `I like ${term}.`, translation: "Example one." },
      { sentence: language === "es" ? `Busco ${term}.` : `I found ${term}.`, translation: "Example two." },
    ],
    definitions: createCardTestLocaleRecord(),
    grammar: [],
  };
}

function openAiResponse(cards: unknown[]) {
  return {
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ cards }) }] }],
  };
}

describe("POST /api/cards/generate-batch", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mockCreate.mockResolvedValue(openAiResponse([
      { index: 1, card: makeCard("es", "sobremesa") },
      { index: 0, card: makeCard("en", "serendipity") },
    ]));
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("generates all cards in one strict GPT request and maps them back to note order", async () => {
    const response = await POST(makeRequest());
    const payload = await response.json() as { cards?: Array<{ language: string; term: string }> };

    expect(response.status).toBe(200);
    expect(payload.cards?.map(({ language, term }) => [language, term])).toEqual([
      ["en", "serendipity"],
      ["es", "sobremesa"],
    ]);
    expect((payload.cards?.[0] as { pronunciation?: string }).pronunciation).toBe("orenek");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const request = mockCreate.mock.calls[0]?.[0] as {
      max_output_tokens: number;
      reasoning: { effort: string };
      text: { format: { schema: { properties: { cards: { minItems: number; maxItems: number } } } } };
    };
    expect(request.max_output_tokens).toBe(4_400);
    expect(request.text.format.schema.properties.cards).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(request.reasoning).toEqual({ effort: "none" });
  });

  it("keeps the batch atomic and fails a malformed mapping without extra GPT calls", async () => {
    mockCreate.mockResolvedValueOnce(openAiResponse([
      { index: 0, card: makeCard("en", "serendipity") },
      { index: 0, card: makeCard("en", "serendipity") },
    ]));

    const response = await POST(makeRequest());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: "upstream_error" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("requires authentication and rejects an empty batch before calling GPT", async () => {
    mockGetCurrentAuthUser.mockResolvedValueOnce(null);
    const unauthorized = await POST(makeRequest());
    expect(unauthorized.status).toBe(401);

    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    const invalid = new Request("http://localhost/api/cards/generate-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cards: [] }),
    });
    const response = await POST(invalid);

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
