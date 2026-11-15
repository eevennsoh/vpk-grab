import type { Position, Rect } from "../types.js";

export const createRectFromCorners = (firstCorner: Position, secondCorner: Position): Rect => ({
  left: Math.min(firstCorner.x, secondCorner.x),
  top: Math.min(firstCorner.y, secondCorner.y),
  right: Math.max(firstCorner.x, secondCorner.x),
  bottom: Math.max(firstCorner.y, secondCorner.y),
});
