import { scoreAiPracticeMessage } from "@/features/ai-practice/ai-practice-scoring";
import { vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mockCreate };
  },
}));

const mockInsert = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));
const mockRpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
    rpc: mockRpc,
  }),
}));

const input = {
  userId: "user-1",
  language: "en" as const,
  characterId: "clara",
  userMessage: "Hello!",
  assistantMessage: "Hi there!",
};

function makeResponse(score: number) {
  return {
    output: [
      {
        type: "message" as const,
        content: [{ type: "output_text" as const, text: JSON.stringify({ score }) }],
      },
    ],
  };
}

describe("scoreAiPracticeMessage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns 5 points for a good response", async () => {
    mockCreate.mockResolvedValue(makeResponse(5));

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(5);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("increment_ai_practice_points", {
      p_user_id: input.userId,
      p_points: 5,
    });
  });

  it("returns 10 points for an excellent response", async () => {
    mockCreate.mockResolvedValue(makeResponse(10));

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(10);
    expect(mockRpc).toHaveBeenCalledWith("increment_ai_practice_points", {
      p_user_id: input.userId,
      p_points: 10,
    });
  });

  it("returns 0 points and does not increment when the score is 0", async () => {
    mockCreate.mockResolvedValue(makeResponse(0));

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("falls back to 0 for invalid scores", async () => {
    mockCreate.mockResolvedValue({
      output: [
        {
          type: "message" as const,
          content: [{ type: "output_text" as const, text: JSON.stringify({ score: 7 }) }],
        },
      ],
    });

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(0);
  });

  it("returns 0 and does not throw when OpenAI fails", async () => {
    mockCreate.mockRejectedValue(new Error("OpenAI error"));

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(0);
  });

  it("returns 0 when the API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    mockCreate.mockResolvedValue(makeResponse(5));

    const result = await scoreAiPracticeMessage(input);

    expect(result.points).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
