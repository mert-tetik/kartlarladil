export type ProgressionPlan = {
  caption: string;
  terms: Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
  narration: Array<{ text: string; phase: "intro" | "term" | "explanation" | "outro"; activeTier: "A1" | "B1" | "C1" | null }>;
};

export type QuizPlan = { caption: string; question: string; prompt: string; reveal: string; explanation: string; transition: string; outro: string };
export type SentencePlan = { caption: string; sentence: string; isCorrect: boolean; correction: string; question: string; reveal: string; explanation: string; intro: string; outro: string };
export type SentenceTranslationPlan = { caption: string; sentence: string; translation: string; commentPrompt: string };

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

function normalizeTier(value: unknown): "A1" | "B1" | "C1" | null {
  const tier = typeof value === "string" ? value.trim().toUpperCase() : value;
  return tier === "A1" || tier === "B1" || tier === "C1" ? tier : null;
}

function normalizeProgressionPhase(value: unknown): "intro" | "term" | "explanation" | "outro" | null {
  const phase = typeof value === "string" ? value.trim().toLowerCase().replaceAll(/[\s_-]+/g, " ") : "";
  if (["term", "word", "say word", "say term"].includes(phase)) return "term";
  if (["explanation", "explain", "meaning", "definition"].includes(phase)) return "explanation";
  if (["intro", "introduction", "opening", "hook"].includes(phase)) return "intro";
  if (["outro", "summary", "closing", "conclusion"].includes(phase)) return "outro";
  return null;
}

function stripRepeatedLeadingTerm(explanation: string, term: string) {
  const trimmed = explanation.trim();
  const withoutOpeningQuote = trimmed.replace(/^["'“‘]+/u, "");
  if (!withoutOpeningQuote.toLocaleLowerCase().startsWith(term.toLocaleLowerCase())) return trimmed;
  const remainder = withoutOpeningQuote.slice(term.length).replace(/^["'”’\s,;:—–-]+/u, "").trim();
  return remainder || trimmed;
}

export function parseProgressionPlan(value: string): ProgressionPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as {
      caption?: unknown;
      terms?: unknown;
      narration?: unknown;
      scenes?: unknown;
      script?: unknown;
      outro?: unknown;
    };
    const caption = cleanText(parsed.caption, 400);
    const rawTerms = Array.isArray(parsed.terms)
      ? parsed.terms
      : parsed.terms && typeof parsed.terms === "object"
        ? Object.entries(parsed.terms as Record<string, unknown>).map(([tier, term]) => ({ tier, term }))
        : null;
    if (!caption || !rawTerms || rawTerms.length !== 3) return null;
    const terms = rawTerms.map((entry) => {
      // Terra naturally returns `word` for vocabulary entries even when the
      // UI calls the collection `terms`. Accept both equivalent schemas so a
      // valid progression is not discarded and retried as a 502.
      const item = entry as { tier?: unknown; level?: unknown; term?: unknown; word?: unknown };
      const term = cleanText(item?.term ?? item?.word, 80);
      const tier = normalizeTier(item?.tier ?? item?.level);
      return term && tier ? { tier, term } : null;
    });
    if (terms.some((term) => !term)) return null;
    const resolvedTerms = terms as Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
    if (new Set(resolvedTerms.map((term) => term.tier)).size !== 3 || new Set(resolvedTerms.map((term) => term.term.toLocaleLowerCase())).size !== 3) return null;

    // Terra occasionally calls this collection `scenes` or `script`, and can
    // return the seven valid scenes in a different order. The renderer owns
    // the pedagogical sequence, so normalize those harmless variants rather
    // than treating them as a failed generation.
    const rawNarration = Array.isArray(parsed.narration)
      ? parsed.narration
      : Array.isArray(parsed.scenes)
        ? parsed.scenes
        : Array.isArray(parsed.script)
          ? parsed.script
          : null;
    if (!rawNarration) return null;
    const narration = rawNarration.map((entry) => {
      const item = entry as { text?: unknown; narration?: unknown; phase?: unknown; type?: unknown; activeTier?: unknown; active_tier?: unknown; tier?: unknown };
      const text = cleanText(item?.text, 220);
      const phase = normalizeProgressionPhase(item?.phase ?? item?.type);
      const rawTier = item?.activeTier ?? item?.active_tier ?? item?.tier;
      const activeTier = rawTier === null || rawTier === undefined || rawTier === "" ? null : normalizeTier(rawTier);
      const acceptsEmptyTier = (phase === "intro" || phase === "outro") && activeTier === null;
      const acceptsActiveTier = (phase === "term" || phase === "explanation") && activeTier !== null;
      return text && phase && (acceptsEmptyTier || acceptsActiveTier)
        ? { text, phase, activeTier }
        : null;
    });
    const resolvedNarration = narration.filter((scene): scene is NonNullable<typeof scene> => scene !== null);
    const narrationByKind = (phase: "term" | "explanation", tier: "A1" | "B1" | "C1") =>
      resolvedNarration.find((scene) => scene.phase === phase && scene.activeTier === tier)?.text;
    const intro = resolvedNarration.find((scene) => scene.phase === "intro")?.text ?? cleanText((parsed as { intro?: unknown }).intro, 220);
    const outro = resolvedNarration.find((scene) => scene.phase === "outro")?.text ?? cleanText(parsed.outro, 220);
    if (!intro || !outro) return null;

    const normalizedNarration = resolvedTerms.flatMap((term) => {
      const explanation = narrationByKind("explanation", term.tier);
      return explanation
        ? [
            { text: narrationByKind("term", term.tier) ?? term.term, phase: "term" as const, activeTier: term.tier },
            { text: stripRepeatedLeadingTerm(explanation, term.term), phase: "explanation" as const, activeTier: term.tier },
          ]
        : [];
    });
    if (normalizedNarration.length !== 6) return null;
    return { caption, terms: resolvedTerms, narration: [{ text: intro, phase: "intro", activeTier: null }, ...normalizedNarration, { text: outro, phase: "outro", activeTier: null }] };
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
    const transition = cleanText(parsed.transition, 180);
    const outro = cleanText(parsed.outro, 180);
    return caption && question && prompt && reveal && explanation && transition && outro ? { caption, question, prompt, reveal, explanation, transition, outro } : null;
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
    const intro = cleanText(parsed.intro, 180);
    const outro = cleanText(parsed.outro, 180);
    return caption && sentence && typeof parsed.isCorrect === "boolean" && question && reveal && explanation && intro && outro && (parsed.isCorrect || correction) ? { caption, sentence, isCorrect: parsed.isCorrect, correction, question, reveal, explanation, intro, outro } : null;
  } catch {
    return null;
  }
}

export function parseSentenceTranslationPlan(value: string): SentenceTranslationPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Record<string, unknown>;
    const caption = cleanText(parsed.caption, 400);
    const sentence = cleanText(parsed.sentence, 220);
    const translation = cleanText(parsed.translation, 260);
    const commentPrompt = cleanText(parsed.commentPrompt, 180);
    return caption && sentence && translation && commentPrompt ? { caption, sentence, translation, commentPrompt } : null;
  } catch {
    return null;
  }
}
