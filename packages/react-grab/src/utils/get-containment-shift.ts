export const getContainmentShift = (
  start: number,
  size: number,
  boundaryStart: number,
  boundaryEnd: number,
): number => {
  if (start + size > boundaryEnd) return Math.max(boundaryEnd - size, boundaryStart) - start;
  if (start < boundaryStart) return boundaryStart - start;
  return 0;
};
