import "server-only";

import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);

export const SERVER_MUSIC_VIDEO_DURATION_SECONDS = 30;
export const SERVER_MUSIC_VIDEO_MIME_TYPE = "video/mp4" as const;

const AUTOMATION_BUCKET = "social-studio-automation";
const MAX_SOURCE_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_RENDERED_VIDEO_BYTES = 100 * 1024 * 1024;
const MUSIC_TRACKS = [
  "music1.mp3",
  "music2.mp3",
  "music3.mp3",
  "music4.mp3",
  "music5.mp3",
  "music6.mp3",
  "music7.mp3",
] as const;

export type ServerMusicVideoResult = {
  data: Buffer;
  mimeType: typeof SERVER_MUSIC_VIDEO_MIME_TYPE;
  musicTrack: string;
};

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}

function ffmpegExecutable() {
  const configured = process.env.FFMPEG_PATH?.trim();
  if (configured) return configured;
  if (ffmpegPath) return ffmpegPath;
  return "ffmpeg";
}

function normalizeFfmpegError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(/\s+/gu, " ").trim().slice(-800);
}

async function runFfmpeg(args: string[]) {
  try {
    const result = await execFileAsync(ffmpegExecutable(), args, {
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    return result;
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "")
      : normalizeFfmpegError(error);
    throw new Error(`server_music_video_ffmpeg_failed:${normalizeFfmpegError(diagnostic)}`);
  }
}

async function downloadSourceImage(imagePath: string, targetPath: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).download(imagePath);
  if (error || !data) throw new Error("server_music_video_source_read_failed");

  const source = Buffer.from(await data.arrayBuffer());
  if (!source.length || source.length > MAX_SOURCE_IMAGE_BYTES) throw new Error("server_music_video_source_invalid");
  await writeFile(targetPath, source);
}

function ffmpegArguments(imagePath: string, musicPath: string, outputPath: string) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-stream_loop",
    "-1",
    "-i",
    musicPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-t",
    String(SERVER_MUSIC_VIDEO_DURATION_SECONDS),
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "stillimage",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

/**
 * Render a stored automation image and one of the licensed local music tracks
 * without depending on a browser tab, WebCodecs, MediaRecorder, or autoplay.
 */
export async function renderServerMusicVideo(imagePath: string): Promise<ServerMusicVideoResult> {
  const workDirectory = await mkdtemp(join(tmpdir(), "foxiesdeck-music-video-"));
  const imageFile = join(workDirectory, "source-image");
  const outputFile = join(workDirectory, "music-video.mp4");
  const musicTrack = pick(MUSIC_TRACKS);
  const musicFile = join(process.cwd(), "public", "social-audio", musicTrack);

  try {
    await downloadSourceImage(imagePath, imageFile);
    await access(musicFile);
    await runFfmpeg(ffmpegArguments(imageFile, musicFile, outputFile));

    const data = await readFile(outputFile);
    if (!data.length || data.length > MAX_RENDERED_VIDEO_BYTES) throw new Error("server_music_video_output_invalid");
    return { data, mimeType: SERVER_MUSIC_VIDEO_MIME_TYPE, musicTrack };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("server_music_video_")) throw error;
    throw new Error(`server_music_video_failed:${normalizeFfmpegError(error)}`);
  } finally {
    await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function serverMusicVideoFfmpegArguments(imagePath: string, musicPath: string, outputPath: string) {
  return ffmpegArguments(imagePath, musicPath, outputPath);
}
