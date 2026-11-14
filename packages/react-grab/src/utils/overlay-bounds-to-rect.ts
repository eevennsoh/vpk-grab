import type { OverlayBounds, Rect } from "../types.js";

export const overlayBoundsToRect = (bounds: OverlayBounds): Rect => ({
  left: bounds.x,
  top: bounds.y,
  right: bounds.x + bounds.width,
  bottom: bounds.y + bounds.height,
});
