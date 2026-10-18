import { describe, expect, it } from "vitest";
import { pickSocialAudioTrack, SOCIAL_AUDIO_TRACKS } from "./social-audio-tracks";

describe("social audio tracks", () => {
  it("defines seven distinct public tracks with matching filenames and URLs", () => {
    expect(SOCIAL_AUDIO_TRACKS).toHaveLength(7);
    expect(new Set(SOCIAL_AUDIO_TRACKS.map(({ filename }) => filename)).size).toBe(7);

    for (const track of SOCIAL_AUDIO_TRACKS) {
      expect(track.url).toBe(`/social-audio/${track.filename}`);
      expect(track.filename).toMatch(/^[a-z0-9-]+\.mp3$/u);
      expect(track.label.trim()).not.toBe("");
    }
  });

  it("can select the first and last track deterministically", () => {
    expect(pickSocialAudioTrack(() => 0)).toBe(SOCIAL_AUDIO_TRACKS[0]);
    expect(pickSocialAudioTrack(() => 0.999)).toBe(SOCIAL_AUDIO_TRACKS.at(-1));
  });
});
