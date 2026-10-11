import sharp from "sharp";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 50_000_000;
const MAX_OUTPUT_DIMENSION = 2000;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("invalid_image", 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return jsonError("invalid_image", 400);
  }

  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    return jsonError("image_too_large", 413);
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    const normalized = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    return Response.json(
      {
        dataUrl: `data:image/jpeg;base64,${normalized.toString("base64")}`,
        mimeType: "image/jpeg",
        name: file.name || "image.jpg",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError("invalid_image", 422);
  }
}

function jsonError(errorCode: string, status: number) {
  return Response.json({ errorCode }, { status, headers: { "Cache-Control": "no-store" } });
}
