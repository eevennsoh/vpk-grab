import type { AnnotationFrame, Rect } from "../types.js";

export const getRotatedBounds = (frame: AnnotationFrame, paddingPx: number): Rect => {
  const halfWidth = frame.width / 2 + paddingPx;
  const halfHeight = frame.height / 2 + paddingPx;
  const cosine = Math.abs(Math.cos(frame.rotation));
  const sine = Math.abs(Math.sin(frame.rotation));
  const extentX = halfWidth * cosine + halfHeight * sine;
  const extentY = halfWidth * sine + halfHeight * cosine;
  return {
    left: frame.centerX - extentX,
    top: frame.centerY - extentY,
    right: frame.centerX + extentX,
    bottom: frame.centerY + extentY,
  };
};
