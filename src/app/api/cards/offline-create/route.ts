import { generatedCardSchema } from "@/features/cards/create-card-schema";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createCustomCardAction } from "@/features/inventory/cloud-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as unknown;
  const parsed = generatedCardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "error", errorCode: "invalid_request" }, { status: 400 });
  }

  const idempotencyKey =
    typeof body === "object" && body !== null && "idempotencyKey" in body
      ? (body as { idempotencyKey?: unknown }).idempotencyKey
      : undefined;
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9._-]{8,100}$/.test(idempotencyKey))) {
    return Response.json({ status: "error", errorCode: "invalid_request" }, { status: 400 });
  }

  const generated = parsed.data;
  const result = await createCustomCardAction({
    language: generated.language,
    tier: generated.tier,
    termKind: generated.termKind,
    idempotencyKey,
    draft: {
      term: generated.term,
      partOfSpeech: generated.partOfSpeech,
      pronunciation: generated.pronunciation,
      translations: generated.translations,
      examples: generated.examples.map((example) => ({
        example: example.sentence,
        translation: example.translation,
      })),
      definitions: generated.definitions,
      grammar: generated.grammar,
      termKind: generated.termKind,
    },
  });

  if (result.status === "error" || !result.data) {
    if (result.errorCode) return Response.json(result, { status: 409 });
    const user = await getCurrentAuthUser();
    return Response.json(result, { status: user ? 500 : 401 });
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
