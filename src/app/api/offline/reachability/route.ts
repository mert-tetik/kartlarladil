export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return new Response(JSON.stringify({ reachable: true }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
