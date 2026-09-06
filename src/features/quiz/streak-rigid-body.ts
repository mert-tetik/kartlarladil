export type RigidBodyState = {
  x: number;
  y: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  rotationVelocity: number;
};

export type StreakExitMotion = {
  background: RigidBodyState;
  number: RigidBodyState;
  icon: RigidBodyState;
};

export const STREAK_RIGID_BODY_PHYSICS = {
  gravity: 1850,
  rotationDrag: 0.995,
  horizontalDrag: 0.998,
} as const;

export function createRigidBodyState({
  velocityX,
  velocityY,
  rotationVelocity,
}: Pick<RigidBodyState, "velocityX" | "velocityY" | "rotationVelocity">): RigidBodyState {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    velocityX,
    velocityY,
    rotationVelocity,
  };
}

function createStreakBody(horizontalVelocity: number, upwardVelocity: number): RigidBodyState {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return createRigidBodyState({
    velocityX: direction * (horizontalVelocity + Math.random() * horizontalVelocity * 0.35),
    velocityY: -(upwardVelocity + Math.random() * upwardVelocity * 0.2),
    rotationVelocity: direction * (220 + Math.random() * 180),
  });
}

export function createStreakExitMotion(): StreakExitMotion {
  return {
    background: createStreakBody(140, 420),
    number: createStreakBody(360, 760),
    icon: createStreakBody(420, 840),
  };
}

export function stepRigidBody(body: RigidBodyState, delta: number): void {
  body.velocityY += STREAK_RIGID_BODY_PHYSICS.gravity * delta;
  body.velocityX *= STREAK_RIGID_BODY_PHYSICS.horizontalDrag;
  body.x += body.velocityX * delta;
  body.y += body.velocityY * delta;
  body.rotation += body.rotationVelocity * delta;
  body.rotationVelocity *= STREAK_RIGID_BODY_PHYSICS.rotationDrag;
}
