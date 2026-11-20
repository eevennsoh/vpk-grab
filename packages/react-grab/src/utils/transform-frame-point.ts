import type { AnnotationFrameTransform, Position } from "../types.js";

// Carries a point through a frame's scale (taken along the frame's own axes)
// and then its turn, so items in a group keep their place within it. Writes
// into `result` so a drag allocates nothing per move.
export const transformFramePoint = (
  pointX: number,
  pointY: number,
  transform: AnnotationFrameTransform,
  result: Position,
): void => {
  const offsetX = pointX - transform.originX;
  const offsetY = pointY - transform.originY;
  const frameCosine = Math.cos(transform.rotation);
  const frameSine = Math.sin(transform.rotation);
  const scaledX = (offsetX * frameCosine + offsetY * frameSine) * transform.scaleX;
  const scaledY = (-offsetX * frameSine + offsetY * frameCosine) * transform.scaleY;
  const outputCosine = Math.cos(transform.rotation + transform.angle);
  const outputSine = Math.sin(transform.rotation + transform.angle);
  result.x = transform.targetX + scaledX * outputCosine - scaledY * outputSine;
  result.y = transform.targetY + scaledX * outputSine + scaledY * outputCosine;
};
