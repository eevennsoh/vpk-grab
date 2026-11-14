import { REDLINE_MIN_DISTANCE_PX } from "../constants.js";
import type { Position, Rect, RedlineGuide, RedlineMeasurement, RedlineSide } from "../types.js";

interface PairRedlineMeasurements {
  measurements: RedlineMeasurement[];
  guides: RedlineGuide[];
}

// A rect read along the axis being measured: `start`/`end` are its edges on
// that axis, `crossStart`/`crossEnd` its edges on the other one.
interface AxisBox {
  start: number;
  end: number;
  crossStart: number;
  crossEnd: number;
}

interface Axis {
  startSide: RedlineSide;
  endSide: RedlineSide;
  toBox: (rect: Rect) => AxisBox;
  toPoint: (along: number, across: number) => Position;
}

interface EdgePair {
  side: RedlineSide;
  anchorEdge: number;
  targetEdge: number;
}

const HORIZONTAL_AXIS: Axis = {
  startSide: "left",
  endSide: "right",
  toBox: (rect) => ({
    start: rect.left,
    end: rect.right,
    crossStart: rect.top,
    crossEnd: rect.bottom,
  }),
  toPoint: (along, across) => ({ x: along, y: across }),
};

const VERTICAL_AXIS: Axis = {
  startSide: "top",
  endSide: "bottom",
  toBox: (rect) => ({
    start: rect.top,
    end: rect.bottom,
    crossStart: rect.left,
    crossEnd: rect.right,
  }),
  toPoint: (along, across) => ({ x: across, y: along }),
};

// A target that sits clear of the anchor on this axis is one gap away from
// it. One that overlaps it (a parent, a child, a box in the next row) is
// compared edge to edge instead: how far its start is from the anchor's
// start, and its end from the anchor's end.
const getEdgePairs = (axis: Axis, anchor: AxisBox, target: AxisBox): EdgePair[] => {
  if (target.end <= anchor.start + REDLINE_MIN_DISTANCE_PX) {
    return [{ side: axis.startSide, anchorEdge: anchor.start, targetEdge: target.end }];
  }
  if (target.start >= anchor.end - REDLINE_MIN_DISTANCE_PX) {
    return [{ side: axis.endSide, anchorEdge: anchor.end, targetEdge: target.start }];
  }
  return [
    { side: axis.startSide, anchorEdge: anchor.start, targetEdge: target.start },
    { side: axis.endSide, anchorEdge: anchor.end, targetEdge: target.end },
  ];
};

const measureAxis = (axis: Axis, anchorRect: Rect, targetRect: Rect): PairRedlineMeasurements => {
  const anchor = axis.toBox(anchorRect);
  const target = axis.toBox(targetRect);

  // Drawn through the stretch both boxes share, so each line lands on both.
  // With nothing shared it runs through the target's middle, and a guide
  // carries the anchor's edge out to meet it.
  const sharedStart = Math.max(anchor.crossStart, target.crossStart);
  const sharedEnd = Math.min(anchor.crossEnd, target.crossEnd);
  const isCrossAxisShared = sharedStart < sharedEnd;
  const across = isCrossAxisShared
    ? (sharedStart + sharedEnd) / 2
    : (target.crossStart + target.crossEnd) / 2;
  const nearestAnchorCrossEdge = across < anchor.crossStart ? anchor.crossStart : anchor.crossEnd;

  const measurements: RedlineMeasurement[] = [];
  const guides: RedlineGuide[] = [];
  for (const { side, anchorEdge, targetEdge } of getEdgePairs(axis, anchor, target)) {
    const distance = Math.abs(targetEdge - anchorEdge);
    if (distance < REDLINE_MIN_DISTANCE_PX) continue;
    measurements.push({
      side,
      distance,
      start: axis.toPoint(anchorEdge, across),
      end: axis.toPoint(targetEdge, across),
    });
    if (isCrossAxisShared) continue;
    guides.push({
      start: axis.toPoint(anchorEdge, nearestAnchorCrossEdge),
      end: axis.toPoint(anchorEdge, across),
    });
  }
  return { measurements, guides };
};

// What holding Alt with one layer selected and another hovered shows in a
// design tool: how far the hovered box is from the selected one. Each
// measurement is named after the anchor edge it starts from.
export const getPairRedlineMeasurements = (anchor: Rect, target: Rect): PairRedlineMeasurements => {
  const horizontal = measureAxis(HORIZONTAL_AXIS, anchor, target);
  const vertical = measureAxis(VERTICAL_AXIS, anchor, target);
  return {
    measurements: [...horizontal.measurements, ...vertical.measurements],
    guides: [...horizontal.guides, ...vertical.guides],
  };
};
