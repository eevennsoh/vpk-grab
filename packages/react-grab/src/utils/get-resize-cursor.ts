import { ANNOTATION_RESIZE_CURSORS } from "../constants.js";
import { getHandleDirectionIndex } from "./get-handle-direction-index.js";

export const getResizeCursor = (
  directionX: number,
  directionY: number,
  rotation: number,
): string => {
  const cursorCount = ANNOTATION_RESIZE_CURSORS.length;
  const directionIndex = getHandleDirectionIndex(directionX, directionY, rotation);
  return ANNOTATION_RESIZE_CURSORS[((directionIndex % cursorCount) + cursorCount) % cursorCount];
};
