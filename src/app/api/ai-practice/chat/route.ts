import { createHash } from "node:crypto";
import OpenAI from "openai";
import type { Response as OpenAIResponse, ResponseStreamEvent } from "openai/resources/responses/responses";
import { getAiPracticeCharacter } from "@/features/ai-practice/ai-practice-data";
import { buildAiPracticeInput, buildAiPracticeInstructions } from "@/features/ai-practice/ai-practice-prompts";
import { aiPracticeChatRequestSchema } from "@/features/ai-practice/ai-practice-schema";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-5-nano";
const MAX_OUTPUT_TOKENS = 420;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  const parsed = aiPracticeChatRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const character = getAiPracticeCharacter(parsed.data.characterId);

  if (!character) {
    return Response.json({ errorCode: "unknown_character" }, { status: 404 });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || DEFAULT_MODEL;
  const instructions = buildAiPracticeInstructions({
    character,
    language: parsed.data.language,
  });
  const input = buildAiPracticeInput({
    character,
    language: parsed.data.language,
    messages: parsed.data.messages,
  });

  let responseStream: AsyncIterable<ResponseStreamEvent>;

  try {
    responseStream = (await openai.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      stream: true,
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createSafetyIdentifier(user.id),
    })) as AsyncIterable<ResponseStreamEvent>;
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        let emittedText = "";
        let fallbackText = "";

        try {
          for await (const event of responseStream) {
            if (event.type === "response.output_text.delta" && event.delta) {
              emittedText += event.delta;
              controller.enqueue(encoder.encode(event.delta));
              continue;
            }

            if (event.type === "response.output_text.done" && event.text) {
              fallbackText = event.text;
              continue;
            }

            if (event.type === "response.completed") {
              fallbackText ||= extractOutputText(event.response);
            }
          }

          if (!emittedText.trim() && fallbackText.trim()) {
            controller.enqueue(encoder.encode(fallbackText));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}

function createSafetyIdentifier(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 64);
}

function extractOutputText(response: OpenAIResponse) {
  return response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}
