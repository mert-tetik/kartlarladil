import { POST } from "@/app/api/ai-practice/score/route";
import { vi } from "vitest";

const mockScoreAiPracticeMessage = vi.hoisted(() => vi.fn());

vi.mock("@/features/ai-practice/ai-practice-scoring", () => ({
  scoreAiPracticeMessage: mockScoreAiPracticeMessage,
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: vi.fn(() =>
    Promise.resolve({
      id: "user-1",
      email: "test@example.com",
      profile: {
        displayName: "Test",
        preferredLanguageCode: "en",
        preferredUiLocale: "en",
        preferredTier: "A1",
        aiPracticePoints: 0,
        chestPoints: 0,
      },
    }),
  ),
}));

describe("POST /api/ai-practice/score", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the points from the scoring service", async () => {
    mockScoreAiPracticeMessage.mockResolvedValue({ points: 5 });

    const request = new Request("http://localhost/api/ai-practice/score", {
      method: "POST",
      body: JSON.stringify({
        language: "en",
        characterId: "clara",
        userMessage: "Hello",
        assistantMessage: "Hi",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { points: number };

    expect(response.status).toBe(200);
    expect(payload.points).toBe(5);
    expect(mockScoreAiPracticeMessage).toHaveBeenCalledWith({
      userId: "user-1",
      language: "en",
      characterId: "clara",
      userMessage: "Hello",
      assistantMessage: "Hi",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    const { getCurrentAuthUser } = await import("@/features/auth/auth-session");
    vi.mocked(getCurrentAuthUser).mockResolvedValue(null);

    const request = new Request("http://localhost/api/ai-practice/score", {
      method: "POST",
      body: JSON.stringify({
        language: "en",
        characterId: "clara",
        userMessage: "Hello",
        assistantMessage: "Hi",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string };

    expect(response.status).toBe(401);
    expect(payload.errorCode).toBe("auth_required");
  });

  it("returns 400 for invalid request bodies", async () => {
    const request = new Request("http://localhost/api/ai-practice/score", {
      method: "POST",
      body: JSON.stringify({ language: "en" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string };

    expect(response.status).toBe(400);
    expect(payload.errorCode).toBe("invalid_request");
  });
});
