import type { DialogueVideoScene } from "@/features/twitter-automation/dialogue-video-renderer";
import type { ConfusedWordsVideoScene } from "@/features/twitter-automation/confused-words-video-renderer";
import type { OriginalMascotLearningVideoMode, OriginalMascotLearningVideoPayload } from "@/features/twitter-automation/original-mascot-learning-video";
import type { LanguageCode, Tier } from "@/types/domain";

const MUSIC_TRACKS = ["/social-audio/music1.mp3", "/social-audio/music2.mp3", "/social-audio/music3.mp3", "/social-audio/music4.mp3", "/social-audio/music5.mp3", "/social-audio/music6.mp3", "/social-audio/music7.mp3"] as const;

export type BrowserVideoPlanOutput = {
  id: string;
  generator: string;
  language: LanguageCode;
  native_language: LanguageCode;
  tier: Tier | "random";
  mediaUrl: string | null;
};

export type BrowserVideoPlan =
  | { kind: "music"; musicUrl: string }
  | {
    kind: "confused";
    caption: string;
    phases: Array<{
      first: { term: string; tier: Tier };
      second: { term: string; tier: Tier };
    }>;
    scenes: ConfusedWordsVideoScene[];
  }
  | {
    kind: "dialogue";
    caption: string;
    backgroundVideoUrl: string;
    backgroundVideoPath?: string;
    firstCharacter: string;
    secondCharacter: string;
    scenes: DialogueVideoScene[];
  }
  | {
    kind: "original";
    caption: string;
    scenes: OriginalMascotLearningVideoPayload["scenes"];
  };

function isDialogueVideo(generator: string) {
  return generator === "marketing-dialogue-video" || generator === "learning-dialogue-video";
}

function isOriginalMascotLearningVideo(generator: string): generator is OriginalMascotLearningVideoMode {
  return generator === "tier-progression-video" || generator === "vocabulary-quiz-video" || generator === "sentence-check-video" || generator === "sentence-translation-video";
}

function randomMusicTrack() {
  return MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)]!;
}

export async function prepareBrowserVideoPlan(output: BrowserVideoPlanOutput, signal: AbortSignal): Promise<BrowserVideoPlan> {
  if (output.tier === "random") throw new Error("browser_video_source_unavailable");

  if (output.generator === "confused-words-video") {
    const response = await fetch("/api/twitter-automation/confused-words-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, tier: output.tier }),
      signal,
    });
    const plan = await response.json().catch(() => null) as {
      caption?: string;
      phases?: Array<{
        first?: { term: string; tier: Tier };
        second?: { term: string; tier: Tier };
      }>;
      scenes?: ConfusedWordsVideoScene[];
      errorCode?: string;
    } | null;
    if (!response.ok || !plan?.caption || !Array.isArray(plan.phases) || plan.phases.length !== 3 || plan.phases.some((phase) => !phase.first || !phase.second) || !Array.isArray(plan.scenes)) {
      throw new Error(plan?.errorCode ?? "confused_words_video_prepare_failed");
    }
    return {
      kind: "confused",
      caption: plan.caption,
      phases: plan.phases.map((phase) => ({ first: phase.first!, second: phase.second! })),
      scenes: plan.scenes,
    };
  }

  if (isDialogueVideo(output.generator)) {
    const response = await fetch("/api/twitter-automation/dialogue-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: output.generator, language: output.language, nativeLanguage: output.native_language }),
      signal,
    });
    const plan = await response.json().catch(() => null) as {
      caption?: string;
      backgroundVideoUrl?: string;
      backgroundVideoPath?: string;
      firstCharacter?: string;
      secondCharacter?: string;
      scenes?: DialogueVideoScene[];
      errorCode?: string;
    } | null;
    if (!response.ok || !plan?.caption || !plan.backgroundVideoUrl || !plan.firstCharacter || !plan.secondCharacter || !Array.isArray(plan.scenes) || !plan.scenes.length) {
      throw new Error(plan?.errorCode ?? "dialogue_video_prepare_failed");
    }
    return {
      kind: "dialogue",
      caption: plan.caption,
      backgroundVideoUrl: plan.backgroundVideoUrl,
      backgroundVideoPath: plan.backgroundVideoPath,
      firstCharacter: plan.firstCharacter,
      secondCharacter: plan.secondCharacter,
      scenes: plan.scenes,
    };
  }

  if (isOriginalMascotLearningVideo(output.generator)) {
    const response = await fetch("/api/twitter-automation/original-mascot-learning-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: output.generator, language: output.language, nativeLanguage: output.native_language }),
      signal,
    });
    const plan = await response.json().catch(() => null) as (OriginalMascotLearningVideoPayload & { errorCode?: string }) | null;
    if (!response.ok || !plan?.caption || !Array.isArray(plan.scenes) || !plan.scenes.length || plan.mode !== output.generator) {
      throw new Error(plan?.errorCode ?? "original_mascot_learning_video_prepare_failed");
    }
    return { kind: "original", caption: plan.caption, scenes: plan.scenes };
  }

  if (!output.mediaUrl) throw new Error("browser_video_source_unavailable");
  return { kind: "music", musicUrl: randomMusicTrack() };
}

export async function getOrCreateBrowserVideoPlan(cache: Map<string, BrowserVideoPlan>, output: BrowserVideoPlanOutput, signal: AbortSignal) {
  const existing = cache.get(output.id);
  if (existing) return existing;
  const plan = await prepareBrowserVideoPlan(output, signal);
  cache.set(output.id, plan);
  return plan;
}
