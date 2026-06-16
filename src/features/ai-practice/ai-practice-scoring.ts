import "server-only";

import OpenAI from "openai";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode } from "@/types/domain";

interface ScoreAiPracticeMessageInput {
  userId: string;
  language: LanguageCode;
  characterId: string;
  userMessage: string;
  assistantMessage: string;
}

export async function scoreAiPracticeMessage(
  input: ScoreAiPracticeMessageInput,
): Promise<{ points: 0 | 5 | 10 }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { points: 0 };
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  try {
    const response = await openai.responses.create({
      model,
      input: buildScoringPrompt(input),
      max_output_tokens: 80,
      text: { format: { type: "json_object" } },
      store: false,
      safety_identifier: createAiPracticeSafetyIdentifier(input.userId),
    });

    const text = extractResponseOutputText(response);
    const score = parseScoreResponse(text);

    await persistAiPracticeScore({ ...input, points: score });

    return { points: score };
  } catch (error) {
    console.error("AI practice scoring failed:", error);

    // Do not break the chat experience; persist a zero score for audit.
    await persistAiPracticeScore({ ...input, points: 0 }).catch(() => {
      // Ignore persistence errors.
    });

    return { points: 0 };
  }
}

function buildScoringPrompt({ language, userMessage, assistantMessage }: ScoreAiPracticeMessageInput): string {
  return [
    `You are a strict evaluator for a ${language} conversation-practice chat.`,
    "",
    "Character's last message:",
    assistantMessage,
    "",
    "Learner's reply:",
    userMessage,
    "",
    'Score the learner\'s reply using this exact JSON format: { "score": 0 }',
    "",
    "Scoring rules (be strict):",
    "- 0: average/acceptable. The reply keeps the conversation going but is unremarkable, has minor mistakes, simple vocabulary, or is too short.",
    "- 5: good answer. Correct grammar, natural flow, good vocabulary, appropriate length, and a relevant response to the character.",
    "- 10: truly excellent answer. Near-native fluency, complex and accurate structures, rich and creative vocabulary, almost no errors. Give 10 very rarely.",
    "",
    "Default to 0 unless the reply clearly deserves 5 or 10.",
  ].join("\n");
}

function parseScoreResponse(text: string | null): 0 | 5 | 10 {
  if (!text?.trim()) {
    return 0;
  }

  try {
    const parsed = JSON.parse(text.trim()) as { score?: unknown };
    const score = Number(parsed.score);

    if (score === 5 || score === 10) {
      return score;
    }
  } catch {
    // Fall back to 0.
  }

  return 0;
}

async function persistAiPracticeScore(
  input: ScoreAiPracticeMessageInput & { points: 0 | 5 | 10 },
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error: insertError } = await supabase.from("ai_practice_scores").insert({
    user_id: input.userId,
    points: input.points,
    message_text: input.userMessage,
    assistant_text: input.assistantMessage,
    character_id: input.characterId,
    language: input.language,
  });

  if (insertError) {
    throw insertError;
  }

  if (input.points > 0) {
    const { error: incrementError } = await supabase.rpc("increment_ai_practice_points", {
      p_user_id: input.userId,
      p_points: input.points,
    });

    if (incrementError) {
      throw incrementError;
    }
  }
}
