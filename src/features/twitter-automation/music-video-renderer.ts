export const MUSIC_VIDEO_DURATION_SECONDS = 30;

type MusicVideoRenderOptions = {
  audioContext: AudioContext;
  durationSeconds?: number;
  imageUrl: string;
  musicUrl: string;
};

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

export function prepareMusicVideoAudio() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("audio_not_supported");

  const audioContext = new AudioContextConstructor();
  void audioContext.resume();
  return audioContext;
}

export async function renderMusicVideo({ audioContext, durationSeconds = MUSIC_VIDEO_DURATION_SECONDS, imageUrl, musicUrl }: MusicVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("video_not_supported");
  }

  const image = await waitForImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
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

  const imageRatio = image.width / image.height;
  let startedAt = 0;
  let frameId = 0;
  let stopped = false;

  const drawFrame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / (durationSeconds * 1000));
    const eased = progress * progress * (3 - 2 * progress);
    const zoom = 1.03 + eased * 0.09;
    const frameRatio = canvas.width / canvas.height;
    const baseWidth = imageRatio > frameRatio ? image.height * frameRatio : image.width;
    const baseHeight = imageRatio > frameRatio ? image.height : image.width / frameRatio;
    const sourceWidth = baseWidth / zoom;
    const sourceHeight = baseHeight / zoom;
    const sourceX = (image.width - sourceWidth) * (0.5 + 0.09 * Math.sin(progress * Math.PI * 1.2));
    const sourceY = (image.height - sourceHeight) * (0.5 - 0.07 * Math.cos(progress * Math.PI));

    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const shade = context.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, "rgba(0,0,0,0.05)");
    shade.addColorStop(1, "rgba(0,0,0,0.2)");
    context.fillStyle = shade;
    context.fillRect(0, 0, canvas.width, canvas.height);

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
    await audioContext.close();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
