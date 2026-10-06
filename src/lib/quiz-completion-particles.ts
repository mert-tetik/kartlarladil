export const QUIZ_COMPLETION_PARTICLE_COUNT = 22;

export type CompletionParticle = {
  startX: number;
  startY: number;
  y: number;
  x: number;
  rotation: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
};

export function createCompletionParticles(): CompletionParticle[] {
  return Array.from({ length: QUIZ_COMPLETION_PARTICLE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 52 + Math.random() * 92;

    return {
      startX: 5 + Math.round(Math.random() * 90),
      startY: 16 + Math.round(Math.random() * 68),
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance),
      rotation: Math.round((Math.random() - 0.5) * 300),
      size: 7 + Math.round(Math.random() * 7),
      duration: 300 + Math.round(Math.random() * 100),
      delay: Math.round(Math.random() * 45),
      color: "#facc15",
    };
  });
}
