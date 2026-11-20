import { ANNOTATION_TRANSFORM_IDENTITY_EPSILON } from "../constants.js";
import type { AnnotationFrameTransform } from "../types.js";

const isNear = (value: number, expected: number): boolean =>
  Math.abs(value - expected) < ANNOTATION_TRANSFORM_IDENTITY_EPSILON;

export const isIdentityFrameTransform = (transform: AnnotationFrameTransform): boolean =>
  isNear(transform.scaleX, 1) &&
  isNear(transform.scaleY, 1) &&
  isNear(transform.angle, 0) &&
  isNear(transform.targetX, transform.originX) &&
  isNear(transform.targetY, transform.originY);
