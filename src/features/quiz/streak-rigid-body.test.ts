import { describe, expect, it } from "vitest";
import {
  createRigidBodyState,
  STREAK_RIGID_BODY_PHYSICS,
  stepRigidBody,
} from "./streak-rigid-body";

describe("streak rigid-body physics", () => {
  it("applies chest-like gravity, velocity and rotation drag", () => {
    const body = createRigidBodyState({
      velocityX: 100,
      velocityY: 0,
      rotationVelocity: 200,
    });

    stepRigidBody(body, 0.1);

    expect(body.velocityY).toBeCloseTo(STREAK_RIGID_BODY_PHYSICS.gravity * 0.1);
    expect(body.x).toBeCloseTo(9.98);
    expect(body.y).toBeCloseTo(18.5);
    expect(body.rotation).toBeCloseTo(20);
    expect(body.rotationVelocity).toBeCloseTo(199);
  });
});
