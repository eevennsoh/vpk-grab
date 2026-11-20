const FULL_TURN_RAD = Math.PI * 2;

export const normalizeAngle = (angle: number): number =>
  angle - FULL_TURN_RAD * Math.round(angle / FULL_TURN_RAD);
