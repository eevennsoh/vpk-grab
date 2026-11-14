import { getElementAdapter } from "../core/element-adapter.js";
import type { ElementRedlines } from "../types.js";
import { createElementBounds } from "./create-element-bounds.js";
import { getPairRedlineMeasurements } from "./get-pair-redline-measurements.js";
import { hasLayoutBox } from "./has-layout-box.js";
import { overlayBoundsToRect } from "./overlay-bounds-to-rect.js";

export const getPairRedlines = (anchor: Element, target: Element): ElementRedlines | null => {
  if (getElementAdapter(anchor) || getElementAdapter(target)) return null;
  const bounds = createElementBounds(anchor);
  const targetBounds = createElementBounds(target);
  if (!hasLayoutBox(bounds) || !hasLayoutBox(targetBounds)) return null;
  return {
    bounds,
    targetBounds,
    ...getPairRedlineMeasurements(overlayBoundsToRect(bounds), overlayBoundsToRect(targetBounds)),
  };
};
