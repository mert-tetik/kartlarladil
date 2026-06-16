import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { askChatRequestSchema } from "@/features/ask/ask-schema";
import { buildAskInput, buildAskInstructions } from "@/features/ask/ask-prompts";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import {
  assertCanUseAi,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = askChatRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const entitlements = await getUserEntitlements(user.id);
  const aiLimitError = await assertCanUseAi(user.id, entitlements.effectivePlan);

  if (aiLimitError) {
    return Response.json({ errorCode: aiLimitError }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;
  const instructions = buildAskInstructions({
    language: parsed.data.language,
    locale: parsed.data.locale,
  });
  const input = buildAskInput({
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
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
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
              fallbackText ||= extractResponseOutputText(event.response);
            }
          }

          if (!emittedText.trim() && fallbackText.trim()) {
            controller.enqueue(encoder.encode(fallbackText));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          await recordAiUsageEvent(user.id, entitlements.effectivePlan, "ask").catch(() => {
            // Ignore usage recording failures so the user still receives the response.
          });
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
