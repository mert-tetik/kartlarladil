import { POST } from "@/app/api/quiz/validate-answer/route";
import { vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
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

  it("returns accepted: true when the model responds with 't'", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "t" } }],
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

  it("returns accepted: false when the model responds with 'y'", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "y" } }],
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
});
