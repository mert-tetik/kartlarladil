import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasDeveloperAdminRequest } from "@/features/developer/developer-auth";
import { publishWithUploadPost } from "@/features/twitter-automation/upload-post-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const imageAssetSchema = z.object({
  dataUrl: z.string().max(7_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
}).strict();

const videoAssetSchema = z.object({
  sourceUrl: z.string().url().max(2_000),
  mimeType: z.enum(["video/mp4", "video/webm"]),
}).strict();

const publishOptionsSchema = z.object({
  instagramMediaType: z.enum(["REELS", "STORIES"]).optional(),
  instagramShareToFeed: z.boolean().optional(),
  tiktokPrivacyLevel: z.enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]).optional(),
  youtubePrivacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
  youtubeCategoryId: z.string().trim().max(20).optional(),
  facebookPageId: z.string().trim().max(100).optional(),
  facebookMediaType: z.enum(["REELS", "STORIES", "VIDEO"]).optional(),
  linkedinVisibility: z.enum(["PUBLIC", "CONNECTIONS", "LOGGED_IN", "CONTAINER"]).optional(),
  threadsTopicTag: z.string().trim().max(100).optional(),
  threadsReplyControl: z.enum(["everyone", "accounts_you_follow", "mentioned_only"]).optional(),
  threadsAltText: z.string().trim().max(1_000).optional(),
  xReplySettings: z.enum(["everyone", "mentionedUsers", "following"]).optional(),
  pinterestBoardId: z.string().trim().max(200).optional(),
  pinterestLink: z.string().url().max(2_000).optional(),
  pinterestAltText: z.string().trim().max(500).optional(),
  blueskyAltText: z.string().trim().max(1_000).optional(),
  blueskyThreadgate: z.enum(["following", "mention", "list", "mutuals"]).optional(),
  gbpLocationId: z.string().trim().max(200).optional(),
  gbpTopicType: z.enum(["STANDARD", "EVENT", "OFFER"]).optional(),
  gbpCtaType: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]).optional(),
  gbpCtaUrl: z.string().url().max(2_000).optional(),
}).strict();

const schema = z.object({
  socialMediaId: z.number().int().positive(),
  title: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(40_000),
  requestId: z.string().trim().min(8).max(200).optional(),
  asset: z.union([imageAssetSchema, videoAssetSchema]).optional(),
  assets: z.array(imageAssetSchema).min(2).max(10).optional(),
  options: publishOptionsSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.asset && value.assets) {
    context.addIssue({ code: "custom", message: "Use asset or assets, not both.", path: ["assets"] });
  }
});

export async function POST(request: NextRequest) {
  if (!await hasDeveloperAdminRequest(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });

  try {
    const result = await publishWithUploadPost(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "upload_post_unavailable";
    const status = errorCode === "account_not_found" ? 404
    : errorCode === "invalid_media" || errorCode === "upload_post_unsupported_content" || errorCode === "upload_post_carousel_limit" || errorCode === "upload_post_reddit_unavailable" ? 400
        : errorCode === "upload_post_not_configured" || errorCode === "upload_post_profile_not_configured" || errorCode === "upload_post_pinterest_board_not_configured" ? 409
          : errorCode === "upload_post_rejected" ? 502 : 503;
    return NextResponse.json({ errorCode }, { status });
  }
}
