import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { cardPronunciationRequestSchema } from "@/features/cards/card-pronunciation";
import {
  processCatalogCardPronunciation,
  processOwnedCardPronunciation,
} from "@/features/cards/card-pronunciation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const parsed = cardPronunciationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  try {
    const result = parsed.data.preview
      ? await processCatalogCardPronunciation(user.id, parsed.data.sourceKey)
      : await processOwnedCardPronunciation(user.id, parsed.data.sourceKey);
    if (!result) {
      return Response.json({ errorCode: "card_not_owned" }, { status: 403 });
    }

    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "failed" }, { status: 503 });
  }
}
