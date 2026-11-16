import { SCREENSHOT_FALLBACK_BACKGROUND_COLOR } from "../constants.js";
import { isCssColorTransparent } from "./is-css-color-transparent.js";

// The colour the browser paints behind the page: the root's background, else
// the body's (CSS propagates it to the canvas), else the default white.
export const getPageCanvasColor = (): string => {
  for (const element of [document.documentElement, document.body]) {
    if (!element) continue;
    const backgroundColor = getComputedStyle(element).backgroundColor;
    if (!isCssColorTransparent(backgroundColor)) return backgroundColor;
  }
  return SCREENSHOT_FALLBACK_BACKGROUND_COLOR;
};
