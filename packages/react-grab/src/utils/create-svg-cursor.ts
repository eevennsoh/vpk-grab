import type { Position } from "../types.js";

const CURSOR_SIZE_PX = 24;
const CURSOR_HALO_STROKE_WIDTH = 4;
const CURSOR_STROKE_WIDTH = 1.75;

// Draws a toolbar icon as a cursor: dark lines over a light halo so it reads
// on any page, with the click point (hotspot) where the icon does its work.
export const createSvgCursor = (iconPath: string, hotspot: Position, fallback: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE_PX}' height='${CURSOR_SIZE_PX}' viewBox='0 0 ${CURSOR_SIZE_PX} ${CURSOR_SIZE_PX}' fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='${iconPath}' stroke='white' stroke-width='${CURSOR_HALO_STROKE_WIDTH}'/><path d='${iconPath}' stroke='black' stroke-width='${CURSOR_STROKE_WIDTH}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot.x} ${hotspot.y}, ${fallback}`;
};
