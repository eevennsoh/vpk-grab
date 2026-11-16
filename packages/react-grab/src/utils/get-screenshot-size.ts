import { SCREENSHOT_MAX_EDGE_PX } from "../constants.js";
import type { ScreenshotSize } from "../types.js";

export const getScreenshotSize = (
  widthPx: number,
  heightPx: number,
  devicePixelRatio: number,
): ScreenshotSize => {
  const longestEdgePx = Math.max(widthPx, heightPx, 1);
  const scale = Math.min(Math.max(devicePixelRatio, 1), SCREENSHOT_MAX_EDGE_PX / longestEdgePx);
  return {
    scale,
    pixelWidth: Math.max(1, Math.round(widthPx * scale)),
    pixelHeight: Math.max(1, Math.round(heightPx * scale)),
  };
};
