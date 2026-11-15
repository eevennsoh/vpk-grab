import { MATERIAL_ICON_VIEW_BOX } from "../material-icon-paths.js";
import type { Position } from "../types.js";

const CURSOR_SIZE_PX = 24;
// In the icon's 960-unit view box: about 3px of halo at the cursor's 24px.
const CURSOR_HALO_STROKE_WIDTH = 120;

// Draws a filled toolbar icon as a cursor: a dark shape inside a light halo so
// it reads on any page, with the click point (hotspot) where the icon does its
// work.
export const createSvgCursor = (iconPath: string, hotspot: Position, fallback: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE_PX}' height='${CURSOR_SIZE_PX}' viewBox='${MATERIAL_ICON_VIEW_BOX}'><path d='${iconPath}' fill='black' stroke='white' stroke-width='${CURSOR_HALO_STROKE_WIDTH}' stroke-linejoin='round' paint-order='stroke'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot.x} ${hotspot.y}, ${fallback}`;
};
