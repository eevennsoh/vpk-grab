import type { Position } from "../types.js";
import { isPointInsideRect } from "./is-point-inside-rect.js";

export const isPositionInsideElement = (
  position: Position | null,
  element: Element | null | undefined,
): boolean => {
  if (!position || !element) return false;
  return isPointInsideRect(position.x, position.y, element.getBoundingClientRect());
};
