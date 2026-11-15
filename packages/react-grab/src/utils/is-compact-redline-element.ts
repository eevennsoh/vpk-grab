import { REDLINE_COMPACT_ELEMENT_MAX_PX } from "../constants.js";
import type { ElementRedlines } from "../types.js";

export const isCompactRedlineElement = (redlines: ElementRedlines): boolean =>
  Math.min(redlines.bounds.width, redlines.bounds.height) < REDLINE_COMPACT_ELEMENT_MAX_PX;
