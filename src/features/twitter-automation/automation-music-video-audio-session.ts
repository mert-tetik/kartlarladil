"use client";

type AutomationMusicVideoAudioSession = {
  audioContext: AudioContext;
  keepAliveGain: GainNode | null;
  keepAliveSource: ConstantSourceNode | null;
};

let activeSession: AutomationMusicVideoAudioSession | null = null;

export function createMusicVideoAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("audio_not_supported");
  return new AudioContextConstructor();
}

export function createOfflineMusicVideoAudioContext() {
  if (typeof OfflineAudioContext === "undefined") throw new Error("offline_audio_not_supported");
  return new OfflineAudioContext(2, 1, 48_000);
}

function currentSession() {
  if (activeSession?.audioContext.state === "closed") activeSession = null;
  return activeSession;
}

function attachSilentKeepAlive(audioContext: AudioContext) {
  try {
    const keepAliveGain = audioContext.createGain();
    keepAliveGain.gain.value = 0;
    const keepAliveSource = audioContext.createConstantSource();
    keepAliveSource.offset.value = 0;
    keepAliveSource.connect(keepAliveGain).connect(audioContext.destination);
    keepAliveSource.start();
    return { keepAliveGain, keepAliveSource };
  } catch {
    return { keepAliveGain: null, keepAliveSource: null };
  }
}

async function resumeAudioContext(audioContext: AudioContext, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("browser_video_render_timeout");
  const resume = audioContext.resume();
  if (!signal) {
    await resume;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("browser_video_render_timeout"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void resume.then(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, (error: unknown) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

/**
 * Must run synchronously inside the Day 1 / 3 / 7 click. The context remains
 * silent but alive for the whole result-screen session, so later video jobs do
 * not need a new autoplay-gated user interaction.
 */
export function unlockAutomationMusicVideoAudio() {
  let session = currentSession();
  if (!session) {
    const audioContext = createMusicVideoAudioContext();
    const keepAlive = attachSilentKeepAlive(audioContext);
    session = { audioContext, ...keepAlive };
    activeSession = session;
  }
  void resumeAudioContext(session.audioContext).catch(() => undefined);
  return session.audioContext;
}

export async function prepareAutomationMusicVideoAudio(signal?: AbortSignal) {
  const session = currentSession();
  const audioContext = session?.audioContext ?? createMusicVideoAudioContext();
  try {
    await resumeAudioContext(audioContext, signal);
    if (audioContext.state !== "running") throw new Error("audio_activation_required");
    return audioContext;
  } catch (error) {
    if (!session && audioContext.state !== "closed") await audioContext.close();
    throw error;
  }
}

export function isAutomationMusicVideoAudioContext(audioContext: BaseAudioContext | null) {
  return Boolean(audioContext && currentSession()?.audioContext === audioContext);
}

/** Close temporary one-off contexts, but never the batch's user-activated one. */
export async function releaseMusicVideoAudioContext(audioContext: BaseAudioContext | null) {
  if (!audioContext || isAutomationMusicVideoAudioContext(audioContext) || audioContext.state === "closed") return;
  const closableContext = audioContext as BaseAudioContext & { close?: () => Promise<void> };
  if (typeof closableContext.close !== "function") return;
  await closableContext.close();
}

export async function closeAutomationMusicVideoAudioSession() {
  const session = currentSession();
  activeSession = null;
  if (!session) return;
  try {
    session.keepAliveSource?.stop();
  } catch {
    // The source may already have stopped while the document was unloading.
  }
  session.keepAliveSource?.disconnect();
  session.keepAliveGain?.disconnect();
  if (session.audioContext.state !== "closed") await session.audioContext.close();
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
