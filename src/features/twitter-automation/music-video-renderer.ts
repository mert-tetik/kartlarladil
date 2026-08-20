import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Output, WebMOutputFormat } from "mediabunny";
import {
  createMusicVideoAudioContext,
  prepareAutomationMusicVideoAudio,
  releaseMusicVideoAudioContext,
  unlockAutomationMusicVideoAudio,
} from "@/features/twitter-automation/automation-music-video-audio-session";

export {
  closeAutomationMusicVideoAudioSession,
  createOfflineMusicVideoAudioContext,
  isAutomationMusicVideoAudioContext,
  releaseMusicVideoAudioContext,
} from "@/features/twitter-automation/automation-music-video-audio-session";

export const MUSIC_VIDEO_DURATION_SECONDS = 30;

type MusicVideoRenderOptions = {
  audioContext: BaseAudioContext;
  durationSeconds?: number;
  imageUrl: string;
  musicUrl: string;
};

type MusicVideoRenderOptionsWithImage = Omit<MusicVideoRenderOptions, "imageUrl"> & {
  image: HTMLImageElement;
};

export type CanvasSafeImage = {
  image: HTMLImageElement;
  release: () => void;
};

const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_000_000;
const AUDIO_BITRATE = 128_000;

function waitForImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_load_failed"));
    image.src = source;
  });
}

function getRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

async function scheduleMusicTrack(context: AudioContext, destination: MediaStreamAudioDestinationNode, musicUrl: string, durationSeconds: number) {
  const response = await fetch(musicUrl);
  if (!response.ok) throw new Error("music_load_failed");

  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  if (buffer.duration < durationSeconds) throw new Error("music_too_short");

  const startTime = context.currentTime + 0.05;
  const endTime = startTime + durationSeconds;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.44, startTime + 0.08);
  gain.gain.setValueAtTime(0.44, endTime - 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(gain).connect(destination);

  const maximumOffset = Math.max(0, buffer.duration - durationSeconds - 0.05);
  const offset = maximumOffset ? Math.random() * maximumOffset : 0;
  source.start(startTime, offset);
  source.stop(endTime);
}

/**
 * Automation images are delivered from Supabase's signed, cross-origin URLs.
 * A canvas may display one of those images, but it becomes tainted and cannot
 * be recorded into a video. Rehydrating the image from a same-origin blob URL
 * keeps the canvas exportable in both WebCodecs and MediaRecorder paths.
 */
export async function loadCanvasSafeImage(source: string): Promise<CanvasSafeImage> {
  const response = await fetch(source);
  if (!response.ok) throw new Error("music_image_load_failed");

  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = await waitForImage(objectUrl);
    return {
      image,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Invoke this synchronously from the original Generate click. That one gesture
 * gives browsers a document-level audio activation for the automated queue.
 */
export function unlockMusicVideoAudio() {
  try { return unlockAutomationMusicVideoAudio(); } catch { return null; }
}

function waitForAudioResume(audioContext: AudioContext, signal?: AbortSignal) {
  if (!signal) return audioContext.resume();
  if (signal.aborted) return Promise.reject(new Error("browser_video_render_timeout"));

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("browser_video_render_timeout"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void audioContext.resume().then(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, (error: unknown) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

export async function prepareMusicVideoAudio(signal?: AbortSignal, options: { reuseAutomationSession?: boolean } = {}) {
  if (options.reuseAutomationSession) return await prepareAutomationMusicVideoAudio(signal);
  const audioContext = createMusicVideoAudioContext();
  try {
    await waitForAudioResume(audioContext, signal);
    if (audioContext.state !== "running") throw new Error("audio_activation_required");
    return audioContext;
  } catch (error) {
    if (audioContext.state !== "closed") await audioContext.close();
    throw error;
  }
}

async function decodeMusic(audioContext: BaseAudioContext, musicUrl: string) {
  const response = await fetch(musicUrl);
  if (!response.ok) throw new Error("music_load_failed");
  return await audioContext.decodeAudioData(await response.arrayBuffer());
}

async function renderOfflineMusic(buffer: AudioBuffer, offset: number, durationSeconds: number) {
  const sampleRate = 48_000;
  const offlineContext = new OfflineAudioContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  const gain = offlineContext.createGain();
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(0.44, 0.08);
  gain.gain.setValueAtTime(0.44, Math.max(0.08, durationSeconds - 0.16));
  gain.gain.exponentialRampToValueAtTime(0.0001, durationSeconds);
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(gain).connect(offlineContext.destination);
  source.start(0, offset, durationSeconds);
  return await offlineContext.startRendering();
}

export async function canRenderMusicVideoDeterministically(width: number, height: number) {
  if (typeof OfflineAudioContext === "undefined") return false;
  return await canEncodeVideo("vp8", { width, height, bitrate: VIDEO_BITRATE })
    && await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE });
}

async function renderDeterministicMusicVideo({ audioContext, durationSeconds, image, musicUrl }: Required<MusicVideoRenderOptionsWithImage>) {
  const buffer = await decodeMusic(audioContext, musicUrl);
  if (buffer.duration < durationSeconds) throw new Error("music_too_short");

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_not_supported");

    const frameCount = Math.ceil(durationSeconds * FRAME_RATE);
    const frameDuration = 1 / FRAME_RATE;
    const maximumOffset = Math.max(0, buffer.duration - durationSeconds - 0.05);
    const offset = maximumOffset ? Math.random() * maximumOffset : 0;
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const videoSource = new CanvasSource(canvas, { codec: "vp8", bitrate: VIDEO_BITRATE, keyFrameInterval: 2 });
    const audioSource = new AudioBufferSource({ codec: "opus", bitrate: AUDIO_BITRATE });
    output.addVideoTrack(videoSource, { maximumPacketCount: frameCount });
    output.addAudioTrack(audioSource);
    await output.start();
    await audioSource.add(await renderOfflineMusic(buffer, offset, frameCount * frameDuration));

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      await videoSource.add(frameIndex * frameDuration, frameDuration, { keyFrame: frameIndex % (FRAME_RATE * 2) === 0 });
    }

    await output.finalize();
    if (!target.buffer) throw new Error("deterministic_recording_failed");
    return new Blob([target.buffer], { type: await output.getMimeType() });
  } finally {
    await releaseMusicVideoAudioContext(audioContext);
  }
}

type RealtimeMusicVideoRenderOptions = Omit<MusicVideoRenderOptionsWithImage, "audioContext"> & { audioContext: AudioContext };

function isRealtimeAudioContext(audioContext: BaseAudioContext): audioContext is AudioContext {
  return "createMediaStreamDestination" in audioContext && typeof audioContext.createMediaStreamDestination === "function";
}

async function renderRealtimeMusicVideo({ audioContext, durationSeconds = MUSIC_VIDEO_DURATION_SECONDS, image, musicUrl }: RealtimeMusicVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("video_not_supported");
  }

  const canvas = document.createElement("canvas");
  // Preserve the exact source-image raster and aspect ratio. Music videos are
  // intentionally a still image with an audio track, not a motion treatment.
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");

  const audioDestination = audioContext.createMediaStreamDestination();
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
  const mimeType = getRecorderMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  const complete = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("recording_failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  let startedAt = 0;
  let frameId = 0;
  let stopped = false;

  const drawFrame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / (durationSeconds * 1000));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (progress < 1 && !stopped) frameId = window.requestAnimationFrame(drawFrame);
  };

  await scheduleMusicTrack(audioContext, audioDestination, musicUrl, durationSeconds);
  startedAt = performance.now();
  drawFrame(startedAt);
  recorder.start(250);

  window.setTimeout(() => {
    stopped = true;
    window.cancelAnimationFrame(frameId);
    videoStream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== "inactive") recorder.stop();
  }, durationSeconds * 1000);

  try {
    return await complete;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    audioDestination.disconnect();
    await releaseMusicVideoAudioContext(audioContext);
  }
}

/**
 * Exports every image-to-music video frame by frame with WebCodecs when
 * available. Older browsers retain the MediaRecorder implementation above.
 */
export async function renderMusicVideo(options: MusicVideoRenderOptions) {
  const source = await loadCanvasSafeImage(options.imageUrl);
  try {
    const width = source.image.naturalWidth || source.image.width;
    const height = source.image.naturalHeight || source.image.height;
    if (await canRenderMusicVideoDeterministically(width, height)) {
      return await renderDeterministicMusicVideo({
        audioContext: options.audioContext,
        durationSeconds: options.durationSeconds ?? MUSIC_VIDEO_DURATION_SECONDS,
        image: source.image,
        musicUrl: options.musicUrl,
      });
    }
    if (!isRealtimeAudioContext(options.audioContext)) throw new Error("browser_video_realtime_audio_required");
    return await renderRealtimeMusicVideo({ ...options, audioContext: options.audioContext, image: source.image });
  } finally {
    source.release();
  }
}
