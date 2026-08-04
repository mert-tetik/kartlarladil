import { describe, expect, it } from "vitest";
import { assertPoyoResponsesOutput, PoyoResponsesProviderError } from "@/features/twitter-automation/social-studio-poyo";
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
});
