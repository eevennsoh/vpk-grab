import { REDLINE_MIN_DISTANCE_PX } from "../constants.js";
import type { Rect, RedlineMeasurement, RedlineSide } from "../types.js";

const REDLINE_SIDES: RedlineSide[] = ["top", "right", "bottom", "left"];

const isHorizontalSide = (side: RedlineSide): boolean => side === "left" || side === "right";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

// The gap from the target's `side` edge to the facing edge of `neighbour`, or
// null when the neighbour is not on that side or does not line up with the
// target on the other axis (a card two rows down is not "to the left").
const getGapToNeighbour = (target: Rect, neighbour: Rect, side: RedlineSide): number | null => {
  const overlapsOnCrossAxis = isHorizontalSide(side)
    ? neighbour.top < target.bottom && neighbour.bottom > target.top
    : neighbour.left < target.right && neighbour.right > target.left;
  if (!overlapsOnCrossAxis) return null;

  switch (side) {
    case "top":
      return target.top - neighbour.bottom;
    case "right":
      return neighbour.left - target.right;
    case "bottom":
      return neighbour.top - target.bottom;
    case "left":
      return target.left - neighbour.right;
    default: {
      const unhandledSide: never = side;
      return unhandledSide;
    }
  }
};

const getGapToContainer = (target: Rect, container: Rect, side: RedlineSide): number => {
  switch (side) {
    case "top":
      return target.top - container.top;
    case "right":
      return container.right - target.right;
    case "bottom":
      return container.bottom - target.bottom;
    case "left":
      return target.left - container.left;
    default: {
      const unhandledSide: never = side;
      return unhandledSide;
    }
  }
};

const createMeasurement = (
  target: Rect,
  side: RedlineSide,
  distance: number,
  crossAxisRange: { start: number; end: number },
): RedlineMeasurement => {
  if (isHorizontalSide(side)) {
    const lineY = clamp((target.top + target.bottom) / 2, crossAxisRange.start, crossAxisRange.end);
    const edgeX = side === "left" ? target.left : target.right;
    const farX = side === "left" ? edgeX - distance : edgeX + distance;
    return { side, distance, start: { x: edgeX, y: lineY }, end: { x: farX, y: lineY } };
  }

  const lineX = clamp((target.left + target.right) / 2, crossAxisRange.start, crossAxisRange.end);
  const edgeY = side === "top" ? target.top : target.bottom;
  const farY = side === "top" ? edgeY - distance : edgeY + distance;
  return { side, distance, start: { x: lineX, y: edgeY }, end: { x: lineX, y: farY } };
};

// What holding Alt over a layer shows in a design tool: on each side, the
// distance to the nearest sibling in that direction, or to the inside edge of
// the container when nothing sits in between.
export const getRedlineMeasurements = (
  target: Rect,
  siblings: Rect[],
  container: Rect | null,
): RedlineMeasurement[] => {
  const measurements: RedlineMeasurement[] = [];

  for (const side of REDLINE_SIDES) {
    let nearestGap = Number.POSITIVE_INFINITY;
    let nearestSibling: Rect | null = null;
    for (const sibling of siblings) {
      const gap = getGapToNeighbour(target, sibling, side);
      if (gap === null || gap < -REDLINE_MIN_DISTANCE_PX || gap >= nearestGap) continue;
      nearestGap = gap;
      nearestSibling = sibling;
    }

    if (nearestSibling) {
      if (nearestGap < REDLINE_MIN_DISTANCE_PX) continue;
      // Drawn through the stretch both boxes share, so the line visibly lands
      // on the neighbour rather than beside it.
      const crossAxisRange = isHorizontalSide(side)
        ? {
            start: Math.max(target.top, nearestSibling.top),
            end: Math.min(target.bottom, nearestSibling.bottom),
          }
        : {
            start: Math.max(target.left, nearestSibling.left),
            end: Math.min(target.right, nearestSibling.right),
          };
      measurements.push(createMeasurement(target, side, nearestGap, crossAxisRange));
      continue;
    }

    if (!container) continue;
    const containerGap = getGapToContainer(target, container, side);
    if (containerGap < REDLINE_MIN_DISTANCE_PX) continue;
    const fullCrossAxisRange = isHorizontalSide(side)
      ? { start: target.top, end: target.bottom }
      : { start: target.left, end: target.right };
    measurements.push(createMeasurement(target, side, containerGap, fullCrossAxisRange));
  }

  return measurements;
};
