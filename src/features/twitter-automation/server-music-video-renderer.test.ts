import { describe, expect, it } from "vitest";
import { SERVER_MUSIC_VIDEO_DURATION_SECONDS, serverMusicVideoFfmpegArguments } from "./server-music-video-renderer";

describe("server music video renderer", () => {
  it("builds a fixed-duration image-plus-audio FFmpeg command", () => {
    const args = serverMusicVideoFfmpegArguments("source.png", "music.mp3", "output.mp4");

    expect(args).toEqual(expect.arrayContaining([
      "-loop",
      "1",
      "-stream_loop",
      "-1",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      String(SERVER_MUSIC_VIDEO_DURATION_SECONDS),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]));
  });
});
