import type { AnnotationFrame, AnnotationStroke } from "../types.js";
import { getAnnotationStrokeBounds } from "./get-annotation-stroke-bounds.js";

// Points are kept unrotated, and the stroke turns about the centre of their
// bounds, so that centre is where it sits on the page too.
export const getAnnotationStrokeFrame = (stroke: AnnotationStroke): AnnotationFrame => {
  const bounds = getAnnotationStrokeBounds(stroke.points, 0);
  if (!bounds) return { centerX: 0, centerY: 0, width: 0, height: 0, rotation: stroke.rotation };
  return {
    centerX: (bounds.left + bounds.right) / 2,
    centerY: (bounds.top + bounds.bottom) / 2,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
    rotation: stroke.rotation,
  };
};
