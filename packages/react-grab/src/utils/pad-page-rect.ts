import type { PageRect } from "../types.js";

export const padPageRect = (
  pageRect: PageRect,
  paddingPx: number,
  documentWidthPx: number,
  documentHeightPx: number,
): PageRect => {
  const left = Math.max(0, pageRect.pageX - paddingPx);
  const top = Math.max(0, pageRect.pageY - paddingPx);
  const right = Math.min(documentWidthPx, pageRect.pageX + pageRect.width + paddingPx);
  const bottom = Math.min(documentHeightPx, pageRect.pageY + pageRect.height + paddingPx);
  return {
    pageX: left,
    pageY: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};
