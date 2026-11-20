import type { AnnotationFrame } from "../types.js";
import { getRotatedBounds } from "./get-rotated-bounds.js";

// One item keeps its own turned frame; a group gets one upright frame around
// everything in it, as a design tool draws it.
export const getAnnotationSelectionFrame = (
  itemFrames: AnnotationFrame[],
): AnnotationFrame | null => {
  if (itemFrames.length === 0) return null;
  if (itemFrames.length === 1) return itemFrames[0];
  const groupBounds = getRotatedBounds(itemFrames[0], 0);
  for (const itemFrame of itemFrames) {
    const itemBounds = getRotatedBounds(itemFrame, 0);
    groupBounds.left = Math.min(groupBounds.left, itemBounds.left);
    groupBounds.top = Math.min(groupBounds.top, itemBounds.top);
    groupBounds.right = Math.max(groupBounds.right, itemBounds.right);
    groupBounds.bottom = Math.max(groupBounds.bottom, itemBounds.bottom);
  }
  return {
    centerX: (groupBounds.left + groupBounds.right) / 2,
    centerY: (groupBounds.top + groupBounds.bottom) / 2,
    width: groupBounds.right - groupBounds.left,
    height: groupBounds.bottom - groupBounds.top,
    rotation: 0,
  };
};
