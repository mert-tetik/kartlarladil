import { scoreAiPracticeMessage } from "@/features/ai-practice/ai-practice-scoring";
import { aiPracticeScoreRequestSchema } from "@/features/ai-practice/ai-practice-schema";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const parsed = aiPracticeScoreRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { points } = await scoreAiPracticeMessage({
    userId: user.id,
    language: parsed.data.language,
    characterId: parsed.data.characterId,
    userMessage: parsed.data.userMessage,
    assistantMessage: parsed.data.assistantMessage,
  });

  return Response.json({ points });
}
