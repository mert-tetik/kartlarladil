import { cardGrammarRequestSchema } from "@/features/cards/card-grammar";
import { processCardGrammarRequest } from "@/features/cards/card-grammar-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const parsed = cardGrammarRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    console.warn("[Grammar Guide] Geçersiz istek alındı.", parsed.error.flatten());
    return jsonError("invalid_request", 400);
  }

  try {
    const result = await processCardGrammarRequest(parsed.data);
    if (result.status === "error") {
      return jsonError(result.errorCode, result.errorCode === "auth_required" ? 401 : 404, result.events);
    }

    if (result.status === "failed") {
      return jsonError(result.errorCode ?? "grammar_generation_failed", 502, result.events);
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Grammar Guide] API isteği beklenmeyen bir hatayla sonuçlandı.", error);
    return jsonError("grammar_generation_failed", 503, ["Grammar Guide API isteği beklenmeyen bir hatayla sonuçlandı."]);
  }
}

function jsonError(errorCode: string, status: number, events?: string[]) {
  return Response.json(
    { errorCode, ...(events ? { events } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
