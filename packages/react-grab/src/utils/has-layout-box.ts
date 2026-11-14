import type { OverlayBounds } from "../types.js";

export const hasLayoutBox = (bounds: OverlayBounds): boolean =>
  bounds.width > 0 && bounds.height > 0;
