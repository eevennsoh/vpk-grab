import type { AnnotationPoint } from "../types.js";

export const updateRectanglePoints = (
  points: AnnotationPoint[],
  pageX: number,
  pageY: number,
  isSquare: boolean,
): void => {
  const origin = points[0];
  let deltaX = pageX - origin.x;
  let deltaY = pageY - origin.y;
  if (isSquare) {
    const sideLengthPx = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    deltaX = deltaX < 0 ? -sideLengthPx : sideLengthPx;
    deltaY = deltaY < 0 ? -sideLengthPx : sideLengthPx;
  }
  points[1].x = origin.x + deltaX;
  points[1].y = origin.y;
  points[2].x = origin.x + deltaX;
  points[2].y = origin.y + deltaY;
  points[3].x = origin.x;
  points[3].y = origin.y + deltaY;
};
