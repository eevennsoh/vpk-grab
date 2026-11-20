import { ANNOTATION_ROTATE_CURSORS } from "../constants.js";
import { getHandleDirectionIndex } from "./get-handle-direction-index.js";

// The top-right corner faces one 45° step before pointing right, and the
// rotate cursors are counted from it.
const TOP_RIGHT_DIRECTION_INDEX = -1;

export const getRotateCursor = (
  directionX: number,
  directionY: number,
  rotation: number,
): string => {
  const cursorCount = ANNOTATION_ROTATE_CURSORS.length;
  const directionIndex =
    getHandleDirectionIndex(directionX, directionY, rotation) - TOP_RIGHT_DIRECTION_INDEX;
  return ANNOTATION_ROTATE_CURSORS[((directionIndex % cursorCount) + cursorCount) % cursorCount];
};
