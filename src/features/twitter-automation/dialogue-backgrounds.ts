import { createSocialStudioBlobSignedUrl, SOCIAL_STUDIO_EXTERNAL_URL_SECONDS } from "@/features/twitter-automation/social-studio-blob";

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

export function isDialogueBackgroundPath(path: string) {
  return (DIALOGUE_BACKGROUND_PATHS as readonly string[]).includes(path);
}

/** Issue a private Blob URL for the exact background path selected for a dialogue. */
export async function getDialogueBackgroundSignedUrl(path: string) {
  if (!isDialogueBackgroundPath(path)) throw new Error("invalid_dialogue_background");
  return await createSocialStudioBlobSignedUrl(path, SOCIAL_STUDIO_EXTERNAL_URL_SECONDS);
}
