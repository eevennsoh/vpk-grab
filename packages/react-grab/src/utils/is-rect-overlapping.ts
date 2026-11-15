import type { Rect } from "../types.js";

export const isRectOverlapping = (firstRect: Rect, secondRect: Rect): boolean =>
  firstRect.left <= secondRect.right &&
  firstRect.right >= secondRect.left &&
  firstRect.top <= secondRect.bottom &&
  firstRect.bottom >= secondRect.top;
