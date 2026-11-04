import { playSoundEffect } from "@/lib/sound-effects";

export type FlowButtonSoundScope = "auth" | "tutorial";

const PITCH_SEQUENCE = [0.9, 1, 1.1] as const;
const sequenceIndexes: Record<FlowButtonSoundScope, number> = {
  auth: 0,
  tutorial: 0,
};

export function playFlowButtonSound(scope: FlowButtonSoundScope) {
  const sequenceIndex = sequenceIndexes[scope];
  sequenceIndexes[scope] = (sequenceIndex + 1) % PITCH_SEQUENCE.length;
  playSoundEffect("result-action-press", { playbackRate: PITCH_SEQUENCE[sequenceIndex] });
}

export function resetFlowButtonSoundSequence(scope: FlowButtonSoundScope) {
  sequenceIndexes[scope] = 0;
}
