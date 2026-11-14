import { ANNOTATION_STRAIGHT_LINE_AXIS_SNAP_DEG } from "../constants.js";
import type { Position } from "../types.js";

export const snapStraightLineEnd = (start: Position, end: Position): Position => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (deltaX === 0 && deltaY === 0) return end;

  const angleFromHorizontalDeg = (Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180) / Math.PI;
  if (angleFromHorizontalDeg <= ANNOTATION_STRAIGHT_LINE_AXIS_SNAP_DEG) {
    return { x: end.x, y: start.y };
  }
  if (angleFromHorizontalDeg >= 90 - ANNOTATION_STRAIGHT_LINE_AXIS_SNAP_DEG) {
    return { x: start.x, y: end.y };
  }
  return end;
};
