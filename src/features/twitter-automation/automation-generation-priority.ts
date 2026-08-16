const AI_TEXT_GENERATORS = new Set([
  "fun-post",
  "word-quiz",
  "language-tip",
  "false-friends",
  "daily-challenge",
  "relatable-learner",
  "tiered-vocabulary",
  "example-sentences",
]);

export type AutomationGenerationPriorityOutput = { generator: string };

export function isAiAutomationGeneration(generator: string) {
  return AI_TEXT_GENERATORS.has(generator)
    || generator.startsWith("ai-")
    || generator.startsWith("music-ai-")
    || generator.startsWith("random");
}

export function prioritizeAutomationGenerations<T extends AutomationGenerationPriorityOutput>(outputs: readonly T[]) {
  return [...outputs].sort((first, second) => Number(isAiAutomationGeneration(first.generator)) - Number(isAiAutomationGeneration(second.generator)));
}

export function aiGenerationBoundaryIndex(outputs: readonly AutomationGenerationPriorityOutput[]) {
  return outputs.reduce((count, output) => count + (isAiAutomationGeneration(output.generator) ? 0 : 1), 0);
}
