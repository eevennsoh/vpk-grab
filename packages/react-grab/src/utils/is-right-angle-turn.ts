import { ANNOTATION_RIGHT_ANGLE_EPSILON_RAD } from "../constants.js";

const QUARTER_TURN_RAD = Math.PI / 2;

export const isRightAngleTurn = (rotation: number): boolean =>
  Math.abs(rotation - Math.round(rotation / QUARTER_TURN_RAD) * QUARTER_TURN_RAD) <
  ANNOTATION_RIGHT_ANGLE_EPSILON_RAD;
