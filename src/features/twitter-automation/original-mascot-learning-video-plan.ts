export type ProgressionPlan = {
  caption: string;
  terms: Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
  narration: Array<{ text: string; voice: "native" | "learning"; activeTier: "A1" | "B1" | "C1" | null }>;
};

export type QuizPlan = { caption: string; question: string; prompt: string; reveal: string; explanation: string };
export type SentencePlan = { caption: string; sentence: string; isCorrect: boolean; correction: string; question: string; reveal: string; explanation: string };

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

export function parseProgressionPlan(value: string): ProgressionPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { caption?: unknown; terms?: unknown; narration?: unknown };
    const caption = cleanText(parsed.caption, 400);
    if (!caption || !Array.isArray(parsed.terms) || !Array.isArray(parsed.narration) || parsed.terms.length !== 3 || parsed.narration.length < 4 || parsed.narration.length > 8) return null;
    const terms = parsed.terms.map((entry) => {
      // Terra naturally returns `word` for vocabulary entries even when the
      // UI calls the collection `terms`. Accept both equivalent schemas so a
      // valid progression is not discarded and retried as a 502.
      const item = entry as { tier?: unknown; term?: unknown; word?: unknown };
      const term = cleanText(item?.term ?? item?.word, 80);
      return term && (item?.tier === "A1" || item?.tier === "B1" || item?.tier === "C1") ? { tier: item.tier, term } : null;
    });
    const narration = parsed.narration.map((entry) => {
      const item = entry as { text?: unknown; voice?: unknown; activeTier?: unknown };
      const text = cleanText(item?.text, 220);
      const activeTier = item?.activeTier === "A1" || item?.activeTier === "B1" || item?.activeTier === "C1" ? item.activeTier : item?.activeTier === null ? null : undefined;
      return text && (item?.voice === "native" || item?.voice === "learning") && activeTier !== undefined ? { text, voice: item.voice, activeTier } : null;
    });
    if (terms.some((term) => !term) || narration.some((scene) => !scene)) return null;
    const resolvedTerms = terms as Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
    const resolvedNarration = narration as ProgressionPlan["narration"];
    if (new Set(resolvedTerms.map((term) => term.tier)).size !== 3 || new Set(resolvedTerms.map((term) => term.term.toLocaleLowerCase())).size !== 3) return null;
    if (!resolvedNarration.some((scene) => scene.activeTier === "A1") || !resolvedNarration.some((scene) => scene.activeTier === "B1") || !resolvedNarration.some((scene) => scene.activeTier === "C1")) return null;
    return { caption, terms: resolvedTerms, narration: resolvedNarration };
  } catch {
    return null;
  }
}

export function parseQuizPlan(value: string): QuizPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Record<string, unknown>;
    const caption = cleanText(parsed.caption, 400);
    const question = cleanText(parsed.question, 180);
    const prompt = cleanText(parsed.prompt, 160);
    const reveal = cleanText(parsed.reveal, 180);
    const explanation = cleanText(parsed.explanation, 260);
    return caption && question && prompt && reveal && explanation ? { caption, question, prompt, reveal, explanation } : null;
  } catch {
    return null;
  }
}

export function parseSentencePlan(value: string): SentencePlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Record<string, unknown>;
    const caption = cleanText(parsed.caption, 400);
    const sentence = cleanText(parsed.sentence, 220);
    const correction = cleanText(parsed.correction, 220) ?? "";
    const question = cleanText(parsed.question, 180);
    const reveal = cleanText(parsed.reveal, 180);
    const explanation = cleanText(parsed.explanation, 300);
    return caption && sentence && typeof parsed.isCorrect === "boolean" && question && reveal && explanation && (parsed.isCorrect || correction) ? { caption, sentence, isCorrect: parsed.isCorrect, correction, question, reveal, explanation } : null;
  } catch {
    return null;
  }
}
