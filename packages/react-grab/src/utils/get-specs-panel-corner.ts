import type { Position, Rect, SpecsPanelCorner } from "../types.js";

interface SpecsPanelCornerOptions {
  viewportWidth: number;
  viewportHeight: number;
  panelWidth: number;
  panelHeight: number;
  margin: number;
  currentCorner: SpecsPanelCorner;
  pointer: Position;
  avoidRects: Rect[];
}

const CORNER_PREFERENCE: SpecsPanelCorner[] = [
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
];

export const getSpecsPanelRect = (
  corner: SpecsPanelCorner,
  options: Pick<
    SpecsPanelCornerOptions,
    "viewportWidth" | "viewportHeight" | "panelWidth" | "panelHeight" | "margin"
  >,
): Rect => {
  const left = corner.endsWith("left")
    ? options.margin
    : options.viewportWidth - options.margin - options.panelWidth;
  const top = corner.startsWith("top")
    ? options.margin
    : options.viewportHeight - options.margin - options.panelHeight;
  return { left, top, right: left + options.panelWidth, bottom: top + options.panelHeight };
};

const doRectsIntersect = (first: Rect, second: Rect): boolean =>
  first.left < second.right &&
  first.right > second.left &&
  first.top < second.bottom &&
  first.bottom > second.top;

const containsPoint = (rect: Rect, point: Position): boolean =>
  point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

// The panel cannot be moved by hand (reaching for it would drop the hover
// being inspected), so it moves itself: it stays where it is while that corner
// is clear, and otherwise takes the first corner that covers neither the
// pointer nor anything in `avoidRects`.
export const getSpecsPanelCorner = (options: SpecsPanelCornerOptions): SpecsPanelCorner => {
  const candidateCorners = [
    options.currentCorner,
    ...CORNER_PREFERENCE.filter((corner) => corner !== options.currentCorner),
  ];

  let cornerClearOfPointer: SpecsPanelCorner | null = null;
  for (const corner of candidateCorners) {
    const panelRect = getSpecsPanelRect(corner, options);
    if (containsPoint(panelRect, options.pointer)) continue;
    cornerClearOfPointer ??= corner;
    if (!options.avoidRects.some((avoidRect) => doRectsIntersect(panelRect, avoidRect))) {
      return corner;
    }
  }
  return cornerClearOfPointer ?? options.currentCorner;
};
