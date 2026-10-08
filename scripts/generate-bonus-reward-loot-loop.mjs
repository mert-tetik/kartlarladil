import fs from "node:fs";

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 20;
const FRAME_COUNT = SAMPLE_RATE * DURATION_SECONDS;
const TAU = Math.PI * 2;

const left = new Float32Array(FRAME_COUNT);
const right = new Float32Array(FRAME_COUNT);

const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const panGains = (pan) => {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

function waveSample(type, phase) {
  const sine = Math.sin(phase);
  if (type === "triangle") return (2 / Math.PI) * Math.asin(sine);
  if (type === "pluck") {
    return sine + Math.sin(phase * 2) * 0.28 + Math.sin(phase * 3) * 0.12;
  }
  return sine;
}

function addTone({ start, duration, midi, amplitude, type = "sine", pan = 0, attack = 0.01, release = 0.12 }) {
  const startFrame = Math.round(start * SAMPLE_RATE);
  const endFrame = Math.min(FRAME_COUNT, Math.round((start + duration) * SAMPLE_RATE));
  const frequency = midiToFrequency(midi);
  const [leftGain, rightGain] = panGains(pan);
  const safeAttack = Math.max(0.001, attack);
  const safeRelease = Math.max(0.001, Math.min(release, duration * 0.8));

  for (let frame = Math.max(0, startFrame); frame < endFrame; frame += 1) {
    const elapsed = (frame - startFrame) / SAMPLE_RATE;
    let envelope = 1;
    if (elapsed < safeAttack) envelope = elapsed / safeAttack;
    else if (elapsed > duration - safeRelease) envelope = (duration - elapsed) / safeRelease;
    if (type === "pluck") envelope *= Math.exp(-elapsed * 1.35);

    const phase = TAU * frequency * elapsed;
    const value = waveSample(type, phase) * amplitude * clamp(envelope, 0, 1);
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function addKick(start, amplitude = 0.2) {
  const startFrame = Math.round(start * SAMPLE_RATE);
  const length = Math.floor(0.2 * SAMPLE_RATE);
  for (let offset = Math.max(0, -startFrame); offset < length && startFrame + offset < FRAME_COUNT; offset += 1) {
    const elapsed = offset / SAMPLE_RATE;
    const envelope = Math.exp(-elapsed * 23);
    const frequency = 145 - elapsed * 92;
    const value = Math.sin(TAU * frequency * elapsed) * envelope * amplitude;
    left[startFrame + offset] += value;
    right[startFrame + offset] += value;
  }
}

function addHat(start, amplitude = 0.025, seed = 1) {
  const startFrame = Math.round(start * SAMPLE_RATE);
  const length = Math.floor(0.055 * SAMPLE_RATE);
  let random = seed >>> 0;
  for (let offset = Math.max(0, -startFrame); offset < length && startFrame + offset < FRAME_COUNT; offset += 1) {
    random = (1664525 * random + 1013904223) >>> 0;
    const noise = (random / 0xffffffff) * 2 - 1;
    const envelope = Math.exp(-(offset / SAMPLE_RATE) * 72);
    const value = noise * envelope * amplitude;
    left[startFrame + offset] += value * 0.8;
    right[startFrame + offset] += value * 1.05;
  }
}

const beatsPerMinute = 144;
const beat = 60 / beatsPerMinute;
const bar = beat * 4;
const beatFrames = Math.round(beat * SAMPLE_RATE);
const barFrames = Math.round(bar * SAMPLE_RATE);
const arpStepFrames = Math.round(beatFrames / 4);
const sparkleOffsetFrames = barFrames - Math.round(beatFrames * 0.78);
const sparkleStepFrames = Math.round(0.075 * SAMPLE_RATE);
const accentOffsetFrames = barFrames - Math.round(beatFrames * 0.35);
const progression = [
  { root: 62, chord: [62, 66, 69, 74] },
  { root: 57, chord: [57, 61, 64, 69] },
  { root: 59, chord: [59, 62, 66, 71] },
  { root: 55, chord: [55, 59, 62, 67] },
];

for (let barIndex = -4; barIndex < 12; barIndex += 1) {
  const start = (barIndex * barFrames) / SAMPLE_RATE;
  const motifBar = ((barIndex % progression.length) + progression.length) % progression.length;
  const harmony = progression[motifBar];

  harmony.chord.forEach((midi, index) => {
    addTone({
      start,
      duration: beat * 0.32,
      midi,
      amplitude: index === 0 ? 0.03 : 0.022,
      type: "triangle",
      pan: (index - 1.5) * 0.12,
      attack: 0.006,
      release: 0.12,
    });
  });

  const arpOffsets = [12, 19, 16, 24, 19, 16, 19, 24, 28, 24, 19, 31, 28, 24, 19, 24];
  arpOffsets.forEach((offset, step) => {
    addTone({
      start: start + (step * arpStepFrames) / SAMPLE_RATE,
      duration: beat * 0.22,
      midi: harmony.root + offset,
      amplitude: 0.084,
      type: "pluck",
      pan: step % 2 === 0 ? -0.38 : 0.38,
      attack: 0.006,
      release: 0.055,
    });
  });

  for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
    const beatStart = start + (beatIndex * beatFrames) / SAMPLE_RATE;
    addTone({
      start: beatStart,
      duration: beat * 0.46,
      midi: harmony.root - 12,
      amplitude: beatIndex === 0 ? 0.14 : 0.1,
      type: "triangle",
      pan: -0.05,
      attack: 0.008,
      release: 0.1,
    });
    addKick(beatStart, beatIndex === 0 ? 0.23 : 0.16);
    addHat(beatStart + (Math.round(beatFrames * 0.5) / SAMPLE_RATE), 0.026, motifBar * 31 + beatIndex);
    addHat(beatStart + (Math.round(beatFrames * 0.75) / SAMPLE_RATE), 0.018, motifBar * 47 + beatIndex + 7);
  }

  const sparkleStart = start + sparkleOffsetFrames / SAMPLE_RATE;
  [harmony.root + 24, harmony.root + 28, harmony.root + 31].forEach((midi, index) => {
    addTone({
      start: sparkleStart + (index * sparkleStepFrames) / SAMPLE_RATE,
      duration: 0.2,
      midi: midi + (motifBar % 2 === 0 ? 0 : 12),
      amplitude: 0.09 - index * 0.01,
      type: "pluck",
      pan: index === 1 ? 0 : index === 0 ? -0.48 : 0.48,
      attack: 0.003,
      release: 0.12,
    });
  });

  if (motifBar === 3) {
    harmony.chord.slice(1).forEach((midi, index) => {
      addTone({
        start: start + accentOffsetFrames / SAMPLE_RATE,
        duration: beat * 0.9,
        midi: midi + 24,
        amplitude: 0.035,
        type: "pluck",
        pan: (index - 1) * 0.4,
        attack: 0.008,
        release: 0.24,
      });
    });
  }
}

// Use one fully rendered motif cycle for every repeat so the loop is sample-identical.
const cycleFrames = barFrames * progression.length;
const stableLeftCycle = left.slice(cycleFrames, cycleFrames * 2);
const stableRightCycle = right.slice(cycleFrames, cycleFrames * 2);
left.set(stableLeftCycle, 0);
left.set(stableLeftCycle, cycleFrames * 2);
right.set(stableRightCycle, 0);
right.set(stableRightCycle, cycleFrames * 2);

let peak = 0;
for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
}
const gain = peak > 0 ? 0.82 / peak : 1;

const headerSize = 44;
const dataSize = FRAME_COUNT * 4;
const buffer = Buffer.alloc(headerSize + dataSize);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

let writeOffset = headerSize;
for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  buffer.writeInt16LE(clamp(Math.round(left[frame] * gain * 32767), -32768, 32767), writeOffset);
  buffer.writeInt16LE(clamp(Math.round(right[frame] * gain * 32767), -32768, 32767), writeOffset + 2);
  writeOffset += 4;
}

const output = process.argv[2] ?? "bonus-reward-loot-loop.wav";
fs.writeFileSync(output, buffer);
console.log(`Generated ${output} (${DURATION_SECONDS}s, ${SAMPLE_RATE}Hz stereo)`);
