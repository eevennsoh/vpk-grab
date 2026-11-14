// Four per-side values written the way the CSS shorthand would be:
// top, right, bottom, left collapse to 1, 2 or 3 values when sides repeat.
export const collapseCssBoxSides = (
  top: string,
  right: string,
  bottom: string,
  left: string,
): string => {
  if (right === left) {
    if (top === bottom) return top === right ? top : `${top} ${right}`;
    return `${top} ${right} ${bottom}`;
  }
  return `${top} ${right} ${bottom} ${left}`;
};
