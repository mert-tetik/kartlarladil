import OpenAI from "openai";
import { AI_PRACTICE_DEFAULT_MODEL, extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTRUCTIONS = [
  "Write one short, playful English X post promoting FoxiesDeck.",
  "FoxiesDeck is a multilingual vocabulary-learning app where learners collect words as cards and review them later.",
  "Make it sound human and fun, not corporate. Mention one concrete product benefit.",
  "Include one or two natural emojis and end with 2 or 3 relevant hashtags, including #languagelearning.",
  "Stay below 260 characters. Return only the post text. Never use an em dash or an en dash; use commas or full stops instead.",
].join("\n");

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL,
      instructions: INSTRUCTIONS,
      input: "Create a new FoxiesDeck post now.",
      max_output_tokens: 120,
      reasoning: { effort: "minimal" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    });
    const post = extractResponseOutputText(response).trim();

    if (!post) {
      return Response.json({ errorCode: "empty_response" }, { status: 502 });
    }

    return Response.json({ post });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }
}
