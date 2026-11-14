import type { Position, Rect } from "../types.js";

export const getAnnotationStrokeBounds = (points: Position[], paddingPx: number): Rect | null => {
  if (points.length === 0) return null;
  const bounds: Rect = {
    left: points[0].x,
    top: points[0].y,
    right: points[0].x,
    bottom: points[0].y,
  };
  for (const point of points) {
    bounds.left = Math.min(bounds.left, point.x);
    bounds.top = Math.min(bounds.top, point.y);
    bounds.right = Math.max(bounds.right, point.x);
    bounds.bottom = Math.max(bounds.bottom, point.y);
  }
  return {
    left: bounds.left - paddingPx,
    top: bounds.top - paddingPx,
    right: bounds.right + paddingPx,
    bottom: bounds.bottom + paddingPx,
  };
};
