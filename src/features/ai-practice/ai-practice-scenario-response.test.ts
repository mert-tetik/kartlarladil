import {
  aiPracticeScenarioHelpResponseSchema,
  parseAiPracticeScenarioHelpResponse,
  parseAiPracticeScenarioResponse,
} from "@/features/ai-practice/ai-practice-scenario-response";

describe("AI practice situation response contract", () => {
  it("accepts the three evaluation tiers and the separate coaching fields", () => {
    const response = parseAiPracticeScenarioResponse(JSON.stringify({
      reply: "Of course, I can show you a quieter table.",
      evaluation: {
        tier: "green",
        explanation: "Yanıtın duruma uygun ve anlaşılır.",
        suggestedReply: "Could we sit by the window, please?",
      },
    }));

    expect(response?.evaluation.tier).toBe("green");
    expect(response?.reply).toContain("quieter table");
  });

  it("accepts markdown-wrapped JSON and never allows more than three help suggestions", () => {
    const response = parseAiPracticeScenarioHelpResponse(`
      \`\`\`json
      {"suggestions":["I'd like a table for two, please.","Could I see the menu?","Do you have anything vegetarian?"]}
      \`\`\`
    `);

    expect(response?.suggestions).toHaveLength(3);
    expect(aiPracticeScenarioHelpResponseSchema.safeParse({ suggestions: ["one", "two", "three", "four"] }).success).toBe(false);
  });

  it("rejects an incomplete evaluator response", () => {
    expect(parseAiPracticeScenarioResponse('{"reply":"Hello"}')).toBeNull();
  });
});
