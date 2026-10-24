import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());
const mockReserveImageTextTranslation = vi.hoisted(() => vi.fn());
const mockCompleteImageTextTranslation = vi.hoisted(() => vi.fn());
const mockReleaseImageTextTranslation = vi.hoisted(() => vi.fn());
const mockGetImageTextTranslationUsage = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const reservationId = "7b14850b-021e-4b37-a035-6ab40853c276";

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mockCreate };
  },
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

vi.mock("@/features/subscriptions/ai-usage-service", () => ({
  reserveImageTextTranslation: mockReserveImageTextTranslation,
  completeImageTextTranslation: mockCompleteImageTextTranslation,
  releaseImageTextTranslation: mockReleaseImageTextTranslation,
  getImageTextTranslationUsage: mockGetImageTextTranslationUsage,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

import { POST } from "@/app/api/cards/image-text-translate/route";

const image = "data:image/png;base64,AAAA";

function makeResponse(
  sentences = [
    { source: "Hello.", translation: "Merhaba.", separators: ["text"] },
  ],
) {
  return {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ sentences }),
          },
        ],
      },
    ],
  };
}

function makeExtractionResponse(text = "Hello.") {
  return {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ text }),
          },
        ],
      },
    ],
  };
}

function makeImageRequest() {
  return new Request("http://localhost/api/cards/image-text-translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "image",
      locale: "tr",
      targetLanguage: "en",
      answerQuestions: true,
      images: [image],
    }),
  });
}

function makeTextRequest() {
  return new Request("http://localhost/api/cards/image-text-translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "text",
      locale: "tr",
      targetLanguage: "en",
      answerQuestions: true,
      text: "Hello.",
    }),
  });
}

describe("POST /api/cards/image-text-translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mockReserveImageTextTranslation.mockResolvedValue({
      status: "reserved",
      reservationId,
    });
    mockCompleteImageTextTranslation.mockResolvedValue(undefined);
    mockReleaseImageTextTranslation.mockResolvedValue(undefined);
    mockGetImageTextTranslationUsage.mockResolvedValue({
      used: 0,
      limit: 2,
      remaining: 2,
      canUse: true,
    });
    mockGetUserEntitlements.mockResolvedValue({ effectivePlan: "free" });
    mockCreate
      .mockResolvedValueOnce(makeExtractionResponse())
      .mockResolvedValueOnce(makeResponse());
  });

  it("reserves quota before model calls and records usage only after a validated result", async () => {
    const response = await POST(makeImageRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sentences: [{ source: "Hello.", translation: "Merhaba." }],
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(
      mockReserveImageTextTranslation.mock.invocationCallOrder[0],
    ).toBeLessThan(mockCreate.mock.invocationCallOrder[0]);
    expect(mockCompleteImageTextTranslation).toHaveBeenCalledWith(
      "user-1",
      reservationId,
    );
    expect(mockReleaseImageTextTranslation).not.toHaveBeenCalled();
    expect(mockCreate.mock.calls[0]?.[0].model).toBe("gpt-4.1-mini");
    expect(mockCreate.mock.calls[1]?.[0].model).toBe("gpt-4.1-mini");
    expect(mockCreate.mock.calls[0]?.[0].reasoning).toBeUndefined();
    expect(mockCreate.mock.calls[1]?.[0].reasoning).toBeUndefined();
    expect(mockCreate.mock.calls[0]?.[0].input[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "input_image",
          image_url: image,
          detail: "high",
        }),
      ]),
    );
    expect(mockCreate.mock.calls[1]?.[0].input[0].content[0]).toMatchObject({
      type: "input_text",
    });
    expect(mockCreate.mock.calls[1]?.[0].input[0].content[0].text).toContain(
      "Hello.",
    );
    expect(mockCreate.mock.calls[1]?.[0].input[0].content).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "input_image" }),
      ]),
    );
  });

  it("does not translate or consume when image extraction finds no text", async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(makeExtractionResponse(""));

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ errorCode: "no_text_detected" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCompleteImageTextTranslation).not.toHaveBeenCalled();
    expect(mockReleaseImageTextTranslation).toHaveBeenCalledWith(
      "user-1",
      reservationId,
    );
  });

  it("keeps direct text translation as a single translation call", async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(makeResponse());

    const response = await POST(makeTextRequest());

    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0]?.[0].model).toBe("gpt-4.1-mini");
    expect(mockCreate.mock.calls[0]?.[0].input[0].content).toEqual([
      expect.objectContaining({ type: "input_text" }),
    ]);
    expect(mockCreate.mock.calls[0]?.[0].input[0].content).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "input_image" }),
      ]),
    );
  });

  it("releases its reservation when OpenAI fails", async () => {
    mockCreate.mockReset();
    mockCreate.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: "upstream_error" });
    expect(mockCompleteImageTextTranslation).not.toHaveBeenCalled();
    expect(mockReleaseImageTextTranslation).toHaveBeenCalledWith(
      "user-1",
      reservationId,
    );
  });

  it("returns a restriction before calling OpenAI when no quota slot remains", async () => {
    mockReserveImageTextTranslation.mockResolvedValueOnce({ status: "limit" });

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      errorCode: "image_text_translate_limit",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCompleteImageTextTranslation).not.toHaveBeenCalled();
  });

  it("fails before OpenAI when the authoritative usage snapshot is exhausted", async () => {
    mockGetImageTextTranslationUsage.mockResolvedValueOnce({
      used: 2,
      limit: 2,
      remaining: 0,
      canUse: false,
    });

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      errorCode: "image_text_translate_limit",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReserveImageTextTranslation).not.toHaveBeenCalled();
  });

  it("surfaces a stable usage-unavailable code when reservation is unavailable", async () => {
    mockReserveImageTextTranslation.mockRejectedValueOnce(
      new Error("PGRST202"),
    );

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "usage_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("does not call OpenAI when the usage snapshot cannot be read", async () => {
    mockGetImageTextTranslationUsage.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "usage_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReserveImageTextTranslation).not.toHaveBeenCalled();
  });

  it("keeps a reservation temporarily if usage completion fails after generation", async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(makeResponse());
    mockCompleteImageTextTranslation.mockRejectedValueOnce(
      new Error("rpc unavailable"),
    );

    const response = await POST(makeTextRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "usage_unavailable" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockReleaseImageTextTranslation).not.toHaveBeenCalled();
  });
});
