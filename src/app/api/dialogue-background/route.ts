import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return new Response("missing_path", { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from("social-studio-assets").download(path);
  if (error || !data) {
    return new Response(error?.message ?? "download_failed", { status: 502 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
