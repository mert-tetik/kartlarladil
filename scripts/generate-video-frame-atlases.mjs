import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import ffmpegStatic from "ffmpeg-static";

const root = process.cwd();
const sourceRoot = join(root, "scripts", "source-media");
const outputRoot = join(root, "public", "video-frame-atlases");
const videos = [
  { id: "tutorial-welcome", source: "mascots/tutorial-welcome/mascot-transparent.webm", fps: 45, width: 720, height: 689, columns: 4, rows: 2, frames: 97 },
  { id: "quiz-feedback-animation-1", source: "quiz-feedback-mascots-v1/animation-1.mp4", fps: 24, width: 480, height: 480, columns: 4, rows: 4, frames: 104 },
  { id: "quiz-feedback-animation-2", source: "quiz-feedback-mascots-v1/animation-2.mp4", fps: 24, width: 480, height: 358, columns: 4, rows: 4, frames: 97 },
  { id: "quiz-feedback-animation-3", source: "quiz-feedback-mascots-v1/animation-3.mp4", fps: 30, width: 480, height: 360, columns: 4, rows: 4, frames: 122 },
  { id: "quiz-feedback-animation-4", source: "quiz-feedback-mascots-v1/animation-4.mp4", fps: 30, width: 480, height: 480, columns: 4, rows: 4, frames: 95 },
  { id: "quiz-feedback-animation-5", source: "quiz-feedback-mascots-v1/animation-5.mp4", fps: 30, width: 480, height: 360, columns: 4, rows: 4, frames: 104 },
  { id: "quiz-feedback-bonus-celebration", source: "quiz-feedback-mascots-v1/Bonus-Celebration.mp4", fps: 30, width: 360, height: 480, columns: 4, rows: 4, frames: 43 },
  { id: "quiz-streak-intro", source: "quiz/streak-reward-background-20260921-intro.mp4", fps: 30, width: 720, height: 1280, columns: 4, rows: 2, frames: 64 },
  { id: "quiz-streak-continuation", source: "quiz/streak-reward-background-20260921-continuation.mp4", fps: 30, width: 720, height: 1280, columns: 4, rows: 2, frames: 58 },
  { id: "rank-up-first", source: "rank-up/rank-up-background-first.mp4", fps: 30, width: 480, height: 480, columns: 4, rows: 4, frames: 39 },
  { id: "rank-up-loop", source: "rank-up/rank-up-background-loopedvideo.mp4", fps: 24, width: 480, height: 480, columns: 4, rows: 4, frames: 97 },
  { id: "quiz-result-message", source: "quiz/result_message_video.mp4", fps: 30, width: 480, height: 854, columns: 4, rows: 4, frames: 145 },
];

const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const requestedIds = process.env.VIDEO_ATLAS_IDS?.split(",").map((id) => id.trim()).filter(Boolean);
const selectedVideos = requestedIds ? videos.filter((video) => requestedIds.includes(video.id)) : videos;

if (requestedIds?.some((id) => !videos.some((video) => video.id === id))) {
  throw new Error(`Unknown VIDEO_ATLAS_IDS value: ${requestedIds.filter((id) => !videos.some((video) => video.id === id)).join(", ")}`);
}

for (const video of selectedVideos) {
  const input = resolve(sourceRoot, video.source);
  const outputDirectory = join(outputRoot, video.id);
  const atlasCount = Math.ceil(video.frames / (video.columns * video.rows));
  const outputPattern = join(outputDirectory, "atlas-%03d.webp");
  const filter = [
    `fps=${video.fps}`,
    `scale=${video.width}:${video.height}:flags=lanczos`,
    "format=rgba",
    `tile=${video.columns}x${video.rows}:nb_frames=${video.columns * video.rows}:padding=0:margin=0:color=black@0`,
  ].join(",");

  mkdirSync(outputDirectory, { recursive: true });
  const result = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-an", "-sn", "-dn", "-vf", filter,
    "-frames:v", String(atlasCount),
    "-c:v", "libwebp", "-quality", "82", "-compression_level", "5",
    outputPattern,
  ], { stdio: "inherit" });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${video.source}`);

  const expectedAtlasFiles = new Set(
    Array.from({ length: atlasCount }, (_, index) => `atlas-${String(index + 1).padStart(3, "0")}.webp`),
  );
  const atlasFiles = readdirSync(outputDirectory).filter((file) => /^atlas-\d{3}\.webp$/u.test(file));
  for (const file of atlasFiles) {
    if (!expectedAtlasFiles.has(file)) unlinkSync(join(outputDirectory, file));
  }
  const currentAtlasFiles = atlasFiles.filter((file) => expectedAtlasFiles.has(file));
  if (currentAtlasFiles.length !== atlasCount) {
    throw new Error(`${video.id}: expected ${atlasCount} atlases, found ${currentAtlasFiles.length}`);
  }
  process.stdout.write(`${video.id}: ${video.frames} frames → ${currentAtlasFiles.length} WebP atlases\n`);
}
