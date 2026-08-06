import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return new Response("missing_path", { status: 400 });

  const config = getSupabaseBrowserConfig();
  const publicUrl = new URL(`/storage/v1/object/public/social-studio-assets/${path}`, config.url).toString();

  const upstream = await fetch(publicUrl);
  if (!upstream.ok) {
    return new Response(`upstream_failed: ${upstream.status}`, { status: 502 });
  }

  const blob = await upstream.blob();
  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
