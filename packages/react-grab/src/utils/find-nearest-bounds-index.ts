import type { OverlayBounds, Position } from "../types.js";

export const findNearestBoundsIndex = (
  boundsList: readonly OverlayBounds[],
  position: Position,
): number => {
  let nearestIndex = -1;
  let nearestDistance = Infinity;
  boundsList.forEach((bounds, boundsIndex) => {
    const horizontalGap = Math.max(bounds.x - position.x, 0, position.x - bounds.x - bounds.width);
    const verticalGap = Math.max(bounds.y - position.y, 0, position.y - bounds.y - bounds.height);
    const distance = Math.hypot(horizontalGap, verticalGap);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = boundsIndex;
    }
  });
  return nearestIndex;
};
