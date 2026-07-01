import { POST } from "@/app/api/quiz/validate-answer/route";
import { vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = {
      create: mockCreate,
    };
  },
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/quiz/validate-answer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/quiz/validate-answer", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("returns accepted: true when the model accepts the answer", async () => {
    mockCreate.mockResolvedValue({
      output_text: '{"accepted": true}',
    });

    const response = await POST(
      makeRequest({
        userAnswer: "apple",
        correctAnswers: ["apple"],
        targetLanguage: "en",
        sourceLanguage: "tr",
        promptContext: "elma",
      }),
    );

    const payload = (await response.json()) as { accepted: boolean };
    expect(response.status).toBe(200);
    expect(payload.accepted).toBe(true);
  });

  it("returns accepted: false when the model rejects the answer", async () => {
    mockCreate.mockResolvedValue({
      output_text: '{"accepted": false}',
    });

    const response = await POST(
      makeRequest({
        userAnswer: "banana",
        correctAnswers: ["apple"],
        targetLanguage: "en",
        sourceLanguage: "tr",
        promptContext: "elma",
      }),
    );

    const payload = (await response.json()) as { accepted: boolean };
    expect(response.status).toBe(200);
    expect(payload.accepted).toBe(false);
  });

  it("returns accepted: false with 503 when OPENAI_API_KEY is missing", async () => {
    process.env.OPENAI_API_KEY = "";

    const response = await POST(
      makeRequest({
        userAnswer: "apple",
        correctAnswers: ["apple"],
        targetLanguage: "en",
        sourceLanguage: "tr",
        promptContext: "elma",
      }),
    );

    const payload = (await response.json()) as { accepted: boolean };
    expect(response.status).toBe(503);
    expect(payload.accepted).toBe(false);
  });

  it("returns accepted: false with 400 for an invalid request body", async () => {
    const response = await POST(makeRequest({ userAnswer: "apple" }));

    const payload = (await response.json()) as { accepted: boolean };
    expect(response.status).toBe(400);
    expect(payload.accepted).toBe(false);
  });

  it("returns accepted: false with 504 when the model call throws", async () => {
    mockCreate.mockRejectedValue(new Error("timeout"));

    const response = await POST(
      makeRequest({
        userAnswer: "apple",
        correctAnswers: ["apple"],
        targetLanguage: "en",
        sourceLanguage: "tr",
        promptContext: "elma",
      }),
    );

    const payload = (await response.json()) as { accepted: boolean };
    expect(response.status).toBe(504);
    expect(payload.accepted).toBe(false);
  });

  it("tells the model to accept lemma or inflection matches like found -> find", async () => {
    mockCreate.mockResolvedValue({
      output_text: '{"accepted": true}',
    });

    await POST(
      makeRequest({
        userAnswer: "find",
        correctAnswers: ["found"],
        targetLanguage: "en",
        sourceLanguage: "tr",
        promptContext: "bulmak",
      }),
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0]?.[0] as {
      input?: Array<{ role: string; content: string }>;
    };
    const systemMessage = call.input?.find((message) => message.role === "system")?.content ?? "";

    expect(systemMessage).toContain("find -> found");
    expect(systemMessage).toContain("found -> find");
    expect(systemMessage).toContain("ran -> run");
  });
});
