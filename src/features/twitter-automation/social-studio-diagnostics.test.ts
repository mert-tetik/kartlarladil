import { describe, expect, it } from "vitest";
import { assertPoyoResponsesOutput, getSocialStudioResponsesErrorCode, getSocialStudioResponsesProviderLabel, OpenAIResponsesProviderError, PoyoResponsesProviderError } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic, formatSocialStudioFailure } from "@/features/twitter-automation/social-studio-diagnostics";

describe("Social Content Studio diagnostics", () => {
  it("recognizes a PoYo business error embedded in an HTTP-success response", () => {
    expect(() => assertPoyoResponsesOutput('{"code":500,"msg":"Server exception, please try again later"}')).toThrow(PoyoResponsesProviderError);
    expect(() => assertPoyoResponsesOutput({ code: 500, msg: "Server exception, please try again later" })).toThrow(PoyoResponsesProviderError);
  });

  it("shows the actionable provider stage and detail without exposing secrets", () => {
    const diagnostic = createSocialStudioDiagnostic({
      stage: "A1 to C1 script plan",
      provider: "PoYo Responses / Terra",
      error: new PoyoResponsesProviderError(500, "Server exception, please try again later"),
      fallbackDetail: "Unused fallback",
    });
    expect(formatSocialStudioFailure({ status: 502 }, { errorCode: "poyo_responses_provider_error", diagnostic }, "Generation failed.")).toContain("Provider: PoYo Responses / Terra 500");
  });

  it("labels direct OpenAI fallback failures without misreporting them as PoYo", () => {
    const error = new OpenAIResponsesProviderError(
      503,
      "gpt-5.6-terra",
      "OpenAI service unavailable",
      3,
      "req_12345678abcdefgh",
    );
    const diagnostic = createSocialStudioDiagnostic({
      stage: "AI image art-direction plan",
      provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"),
      error,
      fallbackDetail: "Unused fallback",
    });

    expect(getSocialStudioResponsesErrorCode(error)).toBe("openai_responses_provider_error");
    const message = formatSocialStudioFailure({ status: 502 }, { errorCode: "openai_responses_provider_error", diagnostic }, "Generation failed.");
    expect(message).toContain("Provider: OpenAI Responses / Terra 503");
    expect(message).toContain("Attempts: 3");
    expect(message).toContain("Request ID: req_12345678abcdefgh");
  });

  it("does not expose arbitrary upstream text as a request ID", () => {
    const diagnostic = createSocialStudioDiagnostic({
      stage: "Text post generation",
      provider: "OpenAI Responses / Luna",
      error: Object.assign(new Error("Upstream error"), { requestId: "Bearer secret-value" }),
      fallbackDetail: "Unused fallback",
    });

    expect(diagnostic.providerRequestId).toBeUndefined();
  });
});
