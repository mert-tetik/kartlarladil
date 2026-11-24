const CHEST_OPENING_FRAMES_PATH = "/chests/opening-frames/";

export function isChestOpeningFrameUrl(url: string) {
  return new URL(url, "https://www.foxiesdeck.com").pathname.startsWith(
    CHEST_OPENING_FRAMES_PATH,
  );
}

export function shouldUseRuntimeImageCache(request: Pick<Request, "destination" | "url">) {
  if (request.destination !== "image") {
    return false;
  }

  return !isChestOpeningFrameUrl(request.url);
}
