const QUARTER_TURN_RAD = Math.PI / 2;

// How much an item's own axis grows when its group is scaled along the
// group's axes. A group only scales unevenly when every item in it is square
// to it, so an item a quarter turn round simply swaps the two axes.
export const getItemAxisScale = (
  scaleX: number,
  scaleY: number,
  relativeRotation: number,
  isVerticalAxis: boolean,
): number => {
  const isQuarterTurned = Math.abs(Math.round(relativeRotation / QUARTER_TURN_RAD)) % 2 === 1;
  return Math.abs(isVerticalAxis === isQuarterTurned ? scaleX : scaleY);
};
