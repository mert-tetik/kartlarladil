import { getDialogueBackgroundSignedUrl, isDialogueBackgroundPath } from "@/features/twitter-automation/dialogue-backgrounds";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!await hasSocialStudioSession(request.headers.get("cookie"))) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return new Response("missing_path", { status: 400 });
  if (!isDialogueBackgroundPath(path)) return new Response("invalid_path", { status: 400 });

  try {
    const sourceUrl = await getDialogueBackgroundSignedUrl(path);
    return Response.json({ path, sourceUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ errorCode: "dialogue_background_unavailable" }, { status: 503 });
  }
}
