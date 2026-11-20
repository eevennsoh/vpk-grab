import { ANNOTATION_CURSOR_DIRECTION_STEP_DEG } from "../constants.js";

const RADIANS_TO_DEGREES = 180 / Math.PI;

// Which of the eight compass directions a handle faces once its frame is
// turned, counted in 45° steps clockwise from pointing right.
export const getHandleDirectionIndex = (
  directionX: number,
  directionY: number,
  rotation: number,
): number => {
  const directionDeg = Math.atan2(directionY, directionX) * RADIANS_TO_DEGREES;
  const rotationDeg = rotation * RADIANS_TO_DEGREES;
  return Math.round((directionDeg + rotationDeg) / ANNOTATION_CURSOR_DIRECTION_STEP_DEG);
};
