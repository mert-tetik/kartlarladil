import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { cancelUploadPostScheduledPost, listUploadPostScheduledPosts } from "@/features/twitter-automation/upload-post-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  jobId: z.string().trim().min(1).max(300),
}).strict();

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  try {
    const posts = await listUploadPostScheduledPosts();
    return NextResponse.json({ posts });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "upload_post_scheduled_posts_unavailable";
    const status = errorCode === "upload_post_not_configured" ? 409 : 502;
    return NextResponse.json({ errorCode, posts: [] }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_scheduled_post" }, { status: 400 });

  try {
    await cancelUploadPostScheduledPost(parsed.data.jobId);
    return NextResponse.json({ ok: true, jobId: parsed.data.jobId });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "upload_post_scheduled_post_cancel_failed";
    const status = errorCode === "upload_post_not_configured" ? 409 : 502;
    return NextResponse.json({ errorCode }, { status });
  }
}
