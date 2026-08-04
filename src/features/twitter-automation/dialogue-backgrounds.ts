import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export const DIALOGUE_BACKGROUND_BUCKET = "social-studio-assets";

export const DIALOGUE_BACKGROUND_PATHS = [
  "dialogue-backgrounds/0526.mp4",
  "dialogue-backgrounds/0527.mp4",
  "dialogue-backgrounds/0528.mp4",
  "dialogue-backgrounds/0529.mp4",
  "dialogue-backgrounds/0530.mp4",
  "dialogue-backgrounds/0531.mp4",
  "dialogue-backgrounds/0532.mp4",
  "dialogue-backgrounds/0533.mp4",
  "dialogue-backgrounds/0534.mp4",
  "dialogue-backgrounds/0535.mp4",
  "dialogue-backgrounds/0536.mp4",
  "dialogue-backgrounds/0537.mp4",
  "dialogue-backgrounds/0538.mp4",
  "dialogue-backgrounds/0539.mp4",
  "dialogue-backgrounds/0540.mp4",
  "dialogue-backgrounds/0541.mp4",
  "dialogue-backgrounds/0542.mp4",
  "dialogue-backgrounds/0543.mp4",
  "dialogue-backgrounds/0544.mp4",
] as const;

export function pickDialogueBackgroundPath(random = Math.random) {
  return DIALOGUE_BACKGROUND_PATHS[Math.floor(random() * DIALOGUE_BACKGROUND_PATHS.length)]!;
}

/** Public CDN URL for one immutable dialogue-background video. */
export function getDialogueBackgroundPublicUrl(random = Math.random) {
  const { url } = getSupabaseBrowserConfig();
  const path = pickDialogueBackgroundPath(random).split("/").map(encodeURIComponent).join("/");
  return new URL(`/storage/v1/object/public/${DIALOGUE_BACKGROUND_BUCKET}/${path}`, url).toString();
}
