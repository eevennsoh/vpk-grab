import { REDLINE_LABEL_GAP_PX, REDLINE_LABEL_HEIGHT_PX } from "../constants.js";
import type { ElementRedlines } from "../types.js";
import { isCompactRedlineElement } from "./is-compact-redline-element.js";

// How far the element's name tag has to drop to clear a bottom distance label
// that a small element pushes out past the end of its line.
export const getRedlineLabelClearance = (redlines: ElementRedlines | null): number => {
  if (!redlines || !isCompactRedlineElement(redlines)) return 0;
  const bottomMeasurement = redlines.measurements.find(
    (measurement) => measurement.side === "bottom",
  );
  if (!bottomMeasurement) return 0;
  return Math.round(bottomMeasurement.distance + REDLINE_LABEL_GAP_PX + REDLINE_LABEL_HEIGHT_PX);
};
