// Ported from Mesurer's core/ink.ts (https://github.com/ibelick/mesurer).
// MIT License, Copyright (c) 2026 Julien Thibeaut. See THIRD_PARTY_NOTICES.md.
//
// Ink is drawn as the filled outline of the stroke rather than as a line of
// one width: the line through the points is smoothed, given a width at each
// point from how slowly it was drawn there, and thinned toward both ends.

import type { AnnotationPoint, Position } from "../types.js";

interface InkSpot extends Position {
  radius: number;
  distanceAlong: number;
}

export const INK_NEUTRAL_WEIGHT = 0.5;

const INK_STREAMLINE_RATIO = 0.5;
const INK_MIN_SPACING_PX = 1;
const INK_THIN_WIDTH_RATIO = 0.4;
const INK_THICK_WIDTH_RATIO = 1.6;
const INK_TAPER_LENGTH_IN_WIDTHS = 5;
// The ends keep this much of their width, so they are rounded and not needle sharp.
const INK_TAPER_FLOOR_RATIO = 0.2;
const INK_FASTEST_SPEED_PX_PER_MS = 2.5;
const INK_WEIGHT_EASE_RATIO = 0.3;

const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

// Heavier the harder a pen is pressed or, without one, the slower the pointer
// moves; eased from the previous weight so the width never jumps.
export const getNextInkWeight = (
  previousWeight: number,
  distancePx: number,
  elapsedMs: number,
  pressure?: number,
): number => {
  const targetWeight =
    pressure ?? 1 - Math.min(1, distancePx / Math.max(1, elapsedMs) / INK_FASTEST_SPEED_PX_PER_MS);
  return (
    Math.round((previousWeight + (targetWeight - previousWeight) * INK_WEIGHT_EASE_RATIO) * 100) /
    100
  );
};

const smoothInkPoints = (points: readonly AnnotationPoint[]): AnnotationPoint[] => {
  let smoothedPoint = points[0];
  return points.map((point, index) => {
    const isEndpoint = index === 0 || index === points.length - 1;
    smoothedPoint = isEndpoint
      ? point
      : {
          ...point,
          x: smoothedPoint.x + (point.x - smoothedPoint.x) * INK_STREAMLINE_RATIO,
          y: smoothedPoint.y + (point.y - smoothedPoint.y) * INK_STREAMLINE_RATIO,
        };
    return smoothedPoint;
  });
};

const createInkLine = (
  points: readonly AnnotationPoint[],
  widthPx: number,
  isStraight: boolean,
): InkSpot[] => {
  const line: InkSpot[] = [];
  let distanceAlong = 0;
  const smoothedPoints = isStraight ? points : smoothInkPoints(points);

  smoothedPoints.forEach((smoothedPoint, index) => {
    const isLastPoint = index === points.length - 1;
    const previousSpot = line[line.length - 1];
    const stepPx = previousSpot
      ? Math.hypot(smoothedPoint.x - previousSpot.x, smoothedPoint.y - previousSpot.y)
      : 0;
    if (previousSpot && stepPx < INK_MIN_SPACING_PX && !isLastPoint) return;
    distanceAlong += stepPx;
    const widthRatio =
      INK_THIN_WIDTH_RATIO + (INK_THICK_WIDTH_RATIO - INK_THIN_WIDTH_RATIO) * points[index].weight;
    line.push({
      x: smoothedPoint.x,
      y: smoothedPoint.y,
      distanceAlong,
      radius: (widthPx / 2) * widthRatio,
    });
  });

  // A ruled line keeps one width end to end, as a ruler-drawn one would.
  if (isStraight) return line;

  const taperLengthPx = Math.min(distanceAlong / 2, widthPx * INK_TAPER_LENGTH_IN_WIDTHS);
  if (taperLengthPx > 0) {
    const getTaperRatio = (distanceFromEnd: number): number => {
      const progress = Math.min(1, distanceFromEnd / taperLengthPx);
      return INK_TAPER_FLOOR_RATIO + (1 - INK_TAPER_FLOOR_RATIO) * progress * (2 - progress);
    };
    for (const spot of line) {
      spot.radius *= Math.min(
        getTaperRatio(spot.distanceAlong),
        getTaperRatio(distanceAlong - spot.distanceAlong),
      );
    }
  }
  return line;
};

// A curve through the points: each is the control point of a curve that ends
// halfway to the next.
const createCurveThrough = (points: Position[]): string =>
  points
    .slice(1)
    .map((point, index) => {
      const previousPoint = points[index];
      return `Q${roundCoordinate(previousPoint.x)} ${roundCoordinate(previousPoint.y)} ${roundCoordinate((previousPoint.x + point.x) / 2)} ${roundCoordinate((previousPoint.y + point.y) / 2)}`;
    })
    .join("");

export const createInkPath = (
  points: readonly AnnotationPoint[],
  widthPx: number,
  isStraight = false,
  isRectangle = false,
): string => {
  if (points.length === 0) return "";
  if (isRectangle) {
    return `M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}L${points[2].x} ${points[2].y}L${points[3].x} ${points[3].y}Z`;
  }
  const line = createInkLine(points, widthPx, isStraight);
  const firstSpot = line[0];
  const lastSpot = line[line.length - 1];

  if (line.length === 1) {
    const radius = roundCoordinate(firstSpot.radius);
    return `M${roundCoordinate(firstSpot.x - firstSpot.radius)} ${roundCoordinate(firstSpot.y)}a${radius} ${radius} 0 1 0 ${roundCoordinate(firstSpot.radius * 2)} 0a${radius} ${radius} 0 1 0 ${roundCoordinate(-firstSpot.radius * 2)} 0Z`;
  }

  const leftEdge: Position[] = [];
  const rightEdge: Position[] = [];
  line.forEach((spot, index) => {
    const spotBefore = line[Math.max(0, index - 1)];
    const spotAfter = line[Math.min(line.length - 1, index + 1)];
    const directionLength = Math.hypot(spotAfter.x - spotBefore.x, spotAfter.y - spotBefore.y) || 1;
    const acrossX = (-(spotAfter.y - spotBefore.y) / directionLength) * spot.radius;
    const acrossY = ((spotAfter.x - spotBefore.x) / directionLength) * spot.radius;
    leftEdge.push({ x: spot.x + acrossX, y: spot.y + acrossY });
    rightEdge.push({ x: spot.x - acrossX, y: spot.y - acrossY });
  });
  rightEdge.reverse();

  const createEndCap = (radius: number, endPoint: Position): string =>
    `A${roundCoordinate(radius)} ${roundCoordinate(radius)} 0 0 0 ${roundCoordinate(endPoint.x)} ${roundCoordinate(endPoint.y)}`;
  const leftEdgeEnd = leftEdge[leftEdge.length - 1];
  const rightEdgeEnd = rightEdge[rightEdge.length - 1];

  return [
    `M${roundCoordinate(leftEdge[0].x)} ${roundCoordinate(leftEdge[0].y)}`,
    createCurveThrough(leftEdge),
    `L${roundCoordinate(leftEdgeEnd.x)} ${roundCoordinate(leftEdgeEnd.y)}`,
    createEndCap(lastSpot.radius, rightEdge[0]),
    createCurveThrough(rightEdge),
    `L${roundCoordinate(rightEdgeEnd.x)} ${roundCoordinate(rightEdgeEnd.y)}`,
    createEndCap(firstSpot.radius, leftEdge[0]),
    "Z",
  ].join("");
};
