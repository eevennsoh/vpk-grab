// How much an item's own axis grows when its group is scaled along the
// group's axes: exact when the item is square to the group, and otherwise the
// nearest scale that keeps the item unskewed.
export const getItemAxisScale = (
  scaleX: number,
  scaleY: number,
  relativeRotation: number,
  isVerticalAxis: boolean,
): number => {
  const cosine = Math.cos(relativeRotation);
  const sine = Math.sin(relativeRotation);
  return isVerticalAxis
    ? Math.hypot(scaleX * sine, scaleY * cosine)
    : Math.hypot(scaleX * cosine, scaleY * sine);
};
