import { describe, expect, it } from "vite-plus/test";
import { ANNOTATION_ROTATE_CURSORS, ANNOTATION_TRANSFORM_MIN_SIZE_PX } from "../src/constants.js";
import type {
  AnnotationFrame,
  AnnotationFrameTransform,
  AnnotationStroke,
  AnnotationText,
} from "../src/types.js";
import { applyFrameResize } from "../src/utils/apply-frame-resize.js";
import { getAnnotationSelectionFrame } from "../src/utils/get-annotation-selection-frame.js";
import { getAnnotationStrokeFrame } from "../src/utils/get-annotation-stroke-frame.js";
import { getAnnotationTextFrame } from "../src/utils/get-annotation-text-frame.js";
import { getHandleDirectionIndex } from "../src/utils/get-handle-direction-index.js";
import { getItemAxisScale } from "../src/utils/get-item-axis-scale.js";
import { getResizeCursor } from "../src/utils/get-resize-cursor.js";
import { getRotateCursor } from "../src/utils/get-rotate-cursor.js";
import { getRotatedBounds } from "../src/utils/get-rotated-bounds.js";
import { getSign } from "../src/utils/get-sign.js";
import { isIdentityFrameTransform } from "../src/utils/is-identity-frame-transform.js";
import { isRightAngleTurn } from "../src/utils/is-right-angle-turn.js";
import { normalizeAngle } from "../src/utils/normalize-angle.js";
import { resolveHeldModifier } from "../src/utils/resolve-held-modifier.js";
import { transformAnnotationStroke } from "../src/utils/transform-annotation-stroke.js";
import { transformAnnotationText } from "../src/utils/transform-annotation-text.js";
import { transformFramePoint } from "../src/utils/transform-frame-point.js";

const QUARTER_TURN = Math.PI / 2;
const EIGHTH_TURN = Math.PI / 4;

const createFrame = (overrides: Partial<AnnotationFrame> = {}): AnnotationFrame => ({
  centerX: 100,
  centerY: 100,
  width: 100,
  height: 50,
  rotation: 0,
  ...overrides,
});

const createTransform = (): AnnotationFrameTransform => ({
  originX: 0,
  originY: 0,
  targetX: 0,
  targetY: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
});

const createRectangle = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  rotation = 0,
): AnnotationStroke => ({
  id: "rectangle",
  points: [
    { x: left, y: top, weight: 0.5 },
    { x: right, y: top, weight: 0.5 },
    { x: right, y: bottom, weight: 0.5 },
    { x: left, y: bottom, weight: 0.5 },
  ],
  isStraight: false,
  isRectangle: true,
  color: "#ff0000",
  rotation,
});

const createNote = (overrides: Partial<AnnotationText> = {}): AnnotationText => ({
  id: "note",
  x: 100,
  y: 110,
  text: "note",
  color: "#ff0000",
  rotation: 0,
  scale: 1,
  ...overrides,
});

const resize = (
  frame: AnnotationFrame,
  handle: [number, number],
  delta: [number, number],
  isAspectLocked = false,
  isFromCenter = false,
) => {
  const result = createTransform();
  applyFrameResize(
    frame,
    handle[0],
    handle[1],
    delta[0],
    delta[1],
    isAspectLocked,
    isFromCenter,
    result,
  );
  return result;
};

const transformStroke = (
  stroke: AnnotationStroke,
  transform: AnnotationFrameTransform,
): AnnotationStroke => {
  const target = { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
  transformAnnotationStroke(stroke, getAnnotationStrokeFrame(stroke), transform, target);
  return target;
};

const transformText = (
  note: AnnotationText,
  baseWidth: number,
  transform: AnnotationFrameTransform,
): AnnotationText => {
  const target = { ...note };
  transformAnnotationText(
    note,
    baseWidth,
    getAnnotationTextFrame(note, baseWidth),
    transform,
    target,
  );
  return target;
};

const expectPointClose = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
};

describe("normalizeAngle", () => {
  it("brings any angle into a single turn around zero", () => {
    expect(normalizeAngle(3 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 10);
    expect(normalizeAngle(-QUARTER_TURN)).toBeCloseTo(-QUARTER_TURN, 10);
    expect(normalizeAngle(4 * Math.PI)).toBeCloseTo(0, 10);
  });
});

describe("getSign", () => {
  it("counts zero as positive", () => {
    expect(getSign(-0.5)).toBe(-1);
    expect(getSign(0)).toBe(1);
    expect(getSign(3)).toBe(1);
  });
});

describe("getRotatedBounds", () => {
  it("is the padded box when upright", () => {
    expect(getRotatedBounds(createFrame(), 2)).toEqual({
      left: 48,
      top: 73,
      right: 152,
      bottom: 127,
    });
  });

  it("swaps width and height at a quarter turn", () => {
    const bounds = getRotatedBounds(createFrame({ rotation: QUARTER_TURN }), 0);
    expect(bounds.left).toBeCloseTo(75, 6);
    expect(bounds.right).toBeCloseTo(125, 6);
    expect(bounds.top).toBeCloseTo(50, 6);
    expect(bounds.bottom).toBeCloseTo(150, 6);
  });

  it("grows to the diagonal extent at an eighth turn", () => {
    const bounds = getRotatedBounds(
      createFrame({ width: 100, height: 100, rotation: EIGHTH_TURN }),
      0,
    );
    expect(bounds.right - bounds.left).toBeCloseTo(100 * Math.SQRT2, 6);
  });
});

describe("getHandleDirectionIndex", () => {
  it("counts 45° steps clockwise from pointing right", () => {
    expect(getHandleDirectionIndex(1, 0, 0)).toBe(0);
    expect(getHandleDirectionIndex(1, 1, 0)).toBe(1);
    expect(getHandleDirectionIndex(0, 1, 0)).toBe(2);
    expect(getHandleDirectionIndex(1, -1, 0)).toBe(-1);
    expect(getHandleDirectionIndex(1, 0, QUARTER_TURN)).toBe(2);
  });
});

describe("getResizeCursor", () => {
  it("picks the cursor along each handle's axis", () => {
    expect(getResizeCursor(1, 0, 0)).toBe("ew-resize");
    expect(getResizeCursor(-1, 0, 0)).toBe("ew-resize");
    expect(getResizeCursor(0, -1, 0)).toBe("ns-resize");
    expect(getResizeCursor(1, 1, 0)).toBe("nwse-resize");
    expect(getResizeCursor(-1, -1, 0)).toBe("nwse-resize");
    expect(getResizeCursor(1, -1, 0)).toBe("nesw-resize");
  });

  it("turns with the frame to the nearest of the eight directions", () => {
    expect(getResizeCursor(1, 0, QUARTER_TURN)).toBe("ns-resize");
    expect(getResizeCursor(1, 0, EIGHTH_TURN)).toBe("nwse-resize");
    expect(getResizeCursor(1, 1, EIGHTH_TURN)).toBe("ns-resize");
    expect(getResizeCursor(1, 0, (10 * Math.PI) / 180)).toBe("ew-resize");
  });
});

describe("getRotateCursor", () => {
  it("starts from the top-right corner and steps clockwise", () => {
    expect(getRotateCursor(1, -1, 0)).toBe(ANNOTATION_ROTATE_CURSORS[0]);
    expect(getRotateCursor(1, 1, 0)).toBe(ANNOTATION_ROTATE_CURSORS[2]);
    expect(getRotateCursor(-1, 1, 0)).toBe(ANNOTATION_ROTATE_CURSORS[4]);
    expect(getRotateCursor(-1, -1, 0)).toBe(ANNOTATION_ROTATE_CURSORS[6]);
  });

  it("turns with the frame", () => {
    expect(getRotateCursor(1, -1, EIGHTH_TURN)).toBe(ANNOTATION_ROTATE_CURSORS[1]);
    expect(getRotateCursor(-1, -1, EIGHTH_TURN)).toBe(ANNOTATION_ROTATE_CURSORS[7]);
    expect(getRotateCursor(-1, -1, QUARTER_TURN)).toBe(ANNOTATION_ROTATE_CURSORS[0]);
  });

  it("draws an SVG cursor with a centred hotspot", () => {
    expect(ANNOTATION_ROTATE_CURSORS).toHaveLength(8);
    expect(new Set(ANNOTATION_ROTATE_CURSORS).size).toBe(8);
    expect(ANNOTATION_ROTATE_CURSORS[0]).toContain("data:image/svg+xml");
    expect(ANNOTATION_ROTATE_CURSORS[0]).toContain("12 12, crosshair");
  });
});

describe("resolveHeldModifier", () => {
  it("follows the key tracker when it changed since the pointer last moved", () => {
    expect(resolveHeldModifier(true, false, false)).toBe(true);
    expect(resolveHeldModifier(false, true, true)).toBe(false);
  });

  it("follows the pointer event while the tracker is unchanged", () => {
    expect(resolveHeldModifier(false, false, true)).toBe(true);
    expect(resolveHeldModifier(true, true, false)).toBe(false);
    expect(resolveHeldModifier(true, true, true)).toBe(true);
    expect(resolveHeldModifier(false, false, false)).toBe(false);
  });
});

describe("applyFrameResize", () => {
  it("drags a corner and keeps the opposite corner in place", () => {
    const result = resize(createFrame(), [1, 1], [20, 10]);
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.scaleY).toBeCloseTo(1.2, 10);
    expect(result.targetX).toBeCloseTo(110, 10);
    expect(result.targetY).toBeCloseTo(105, 10);
  });

  it("drags an edge along one axis only", () => {
    const result = resize(createFrame(), [-1, 0], [-50, 30]);
    expect(result.scaleX).toBeCloseTo(1.5, 10);
    expect(result.scaleY).toBe(1);
    expect(result.targetX).toBeCloseTo(75, 10);
    expect(result.targetY).toBeCloseTo(100, 10);
  });

  it("locks the aspect ratio to the axis that moved most", () => {
    const result = resize(createFrame(), [1, 1], [50, 5], true);
    expect(result.scaleX).toBeCloseTo(1.5, 10);
    expect(result.scaleY).toBeCloseTo(1.5, 10);
    expect(result.targetX).toBeCloseTo(125, 10);
    expect(result.targetY).toBeCloseTo(112.5, 10);
  });

  it("locks the ratio to an inward drag on one axis, shrinking both", () => {
    const result = resize(createFrame(), [1, 1], [-50, 0], true);
    expect(result.scaleX).toBeCloseTo(0.5, 10);
    expect(result.scaleY).toBeCloseTo(0.5, 10);
    expect(result.targetX).toBeCloseTo(75, 10);
    expect(result.targetY).toBeCloseTo(87.5, 10);
  });

  it("locks the ratio to an outward drag on one axis, growing both", () => {
    const result = resize(createFrame(), [1, 1], [0, 25], true);
    expect(result.scaleX).toBeCloseTo(1.5, 10);
    expect(result.scaleY).toBeCloseTo(1.5, 10);
  });

  it("locks a mixed drag to the axis whose proportion changed most", () => {
    const shrinking = resize(createFrame(), [1, 1], [-60, 10], true);
    expect(shrinking.scaleX).toBeCloseTo(0.4, 10);
    expect(shrinking.scaleY).toBeCloseTo(0.4, 10);
    const growing = resize(createFrame(), [1, 1], [-20, 40], true);
    expect(growing.scaleX).toBeCloseTo(1.8, 10);
    expect(growing.scaleY).toBeCloseTo(1.8, 10);
  });

  it("locks an edge drag by scaling the other axis about its middle", () => {
    const result = resize(createFrame(), [0, 1], [0, 25], true);
    expect(result.scaleX).toBeCloseTo(1.5, 10);
    expect(result.scaleY).toBeCloseTo(1.5, 10);
    expect(result.targetX).toBeCloseTo(100, 10);
    expect(result.targetY).toBeCloseTo(112.5, 10);
  });

  it("resizes from the centre with twice the travel", () => {
    const result = resize(createFrame(), [1, 0], [10, 0], false, true);
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.targetX).toBe(100);
    expect(result.targetY).toBe(100);
  });

  it("flips past the opposite side", () => {
    const result = resize(createFrame(), [1, 0], [-150, 0]);
    expect(result.scaleX).toBeCloseTo(-0.5, 10);
    expect(result.targetX).toBeCloseTo(25, 10);
  });

  it("never shrinks below the minimum size", () => {
    const result = resize(createFrame(), [1, 0], [-100, 0]);
    expect(Math.abs(result.scaleX) * 100).toBeCloseTo(ANNOTATION_TRANSFORM_MIN_SIZE_PX, 10);
    const locked = resize(createFrame(), [1, 1], [-100, -50], true);
    expect(Math.abs(locked.scaleY) * 50).toBeCloseTo(ANNOTATION_TRANSFORM_MIN_SIZE_PX, 10);
    expect(Math.abs(locked.scaleX)).toBeCloseTo(Math.abs(locked.scaleY), 10);
  });

  it("measures the drag along a turned frame's own axes", () => {
    const result = resize(createFrame({ rotation: QUARTER_TURN }), [1, 0], [0, 20]);
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.scaleY).toBe(1);
    expect(result.targetX).toBeCloseTo(100, 10);
    expect(result.targetY).toBeCloseTo(110, 10);
  });

  it("leaves an axis with nothing to stretch alone", () => {
    const result = resize(createFrame({ height: 0 }), [1, 1], [20, 30], true);
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.scaleY).toBe(1);
  });
});

describe("transformFramePoint", () => {
  it("scales along the frame's axes and then turns", () => {
    const transform = createTransform();
    transform.originX = 10;
    transform.targetX = 10;
    transform.scaleX = 2;
    transform.angle = QUARTER_TURN;
    const result = { x: 0, y: 0 };
    transformFramePoint(20, 0, transform, result);
    expectPointClose(result, { x: 10, y: 20 });
  });
});

describe("getItemAxisScale", () => {
  it("takes the group's axes as they are for an item square to it", () => {
    expect(getItemAxisScale(2, 1, 0, false)).toBe(2);
    expect(getItemAxisScale(2, -1, Math.PI, true)).toBe(1);
  });

  it("swaps the group's axes for an item a quarter turn round", () => {
    expect(getItemAxisScale(2, 1, QUARTER_TURN, false)).toBe(1);
    expect(getItemAxisScale(2, 1, QUARTER_TURN, true)).toBe(2);
    expect(getItemAxisScale(2, 1, -QUARTER_TURN, false)).toBe(1);
  });

  it("is the even scale for an item at a slant", () => {
    expect(getItemAxisScale(3, -3, 0.7, true)).toBe(3);
    expect(getItemAxisScale(3, -3, EIGHTH_TURN, false)).toBe(3);
  });
});

describe("isRightAngleTurn", () => {
  it("counts upright and quarter turns, within a hair, and nothing between", () => {
    expect(isRightAngleTurn(0)).toBe(true);
    expect(isRightAngleTurn(QUARTER_TURN)).toBe(true);
    expect(isRightAngleTurn(-Math.PI + 0.0001)).toBe(true);
    expect(isRightAngleTurn(3 * QUARTER_TURN)).toBe(true);
    expect(isRightAngleTurn(EIGHTH_TURN)).toBe(false);
    expect(isRightAngleTurn(0.01)).toBe(false);
  });
});

describe("isIdentityFrameTransform", () => {
  it("is true only when nothing scales, turns or moves", () => {
    const transform = createTransform();
    expect(isIdentityFrameTransform(transform)).toBe(true);
    transform.scaleX = 1 + 1e-9;
    expect(isIdentityFrameTransform(transform)).toBe(true);
    expect(isIdentityFrameTransform({ ...transform, scaleY: 1.01 })).toBe(false);
    expect(isIdentityFrameTransform({ ...transform, scaleX: -1 })).toBe(false);
    expect(isIdentityFrameTransform({ ...transform, angle: 0.01 })).toBe(false);
    expect(isIdentityFrameTransform({ ...transform, targetX: 1 })).toBe(false);
  });
});

describe("annotation frames", () => {
  it("takes a stroke's frame from its unrotated points", () => {
    expect(getAnnotationStrokeFrame(createRectangle(10, 20, 110, 70, 0.5))).toEqual({
      centerX: 60,
      centerY: 45,
      width: 100,
      height: 50,
      rotation: 0.5,
    });
  });

  it("takes a note's frame from its unscaled box and scales its size", () => {
    expect(getAnnotationTextFrame(createNote({ scale: 2 }), 40)).toEqual({
      centerX: 120,
      centerY: 110,
      width: 80,
      height: 40,
      rotation: 0,
    });
  });

  it("frames one item as itself and a group upright around every item", () => {
    const single = createFrame({ rotation: 0.3 });
    expect(getAnnotationSelectionFrame([single])).toBe(single);
    expect(getAnnotationSelectionFrame([])).toBeNull();
    expect(
      getAnnotationSelectionFrame([
        createFrame(),
        createFrame({ centerX: 300, rotation: QUARTER_TURN }),
      ]),
    ).toEqual({ centerX: 187.5, centerY: 100, width: 275, height: 100, rotation: 0 });
  });
});

describe("transformAnnotationStroke", () => {
  it("stretches a rectangle's points and keeps it a rectangle", () => {
    const rectangle = createRectangle(50, 75, 150, 125);
    const transform = resize(getAnnotationStrokeFrame(rectangle), [1, 0], [50, 0]);
    const resized = transformStroke(rectangle, transform);
    expect(resized.points.map((point) => [point.x, point.y])).toEqual([
      [50, 75],
      [200, 75],
      [200, 125],
      [50, 125],
    ]);
    expect(resized.rotation).toBe(0);
  });

  it("resizes a turned rectangle along its own axes and keeps its turn", () => {
    const rectangle = createRectangle(50, 75, 150, 125, QUARTER_TURN);
    const frame = getAnnotationStrokeFrame(rectangle);
    const resized = transformStroke(rectangle, resize(frame, [1, 0], [0, 50]));
    const resizedFrame = getAnnotationStrokeFrame(resized);
    expect(resizedFrame.width).toBeCloseTo(150, 6);
    expect(resizedFrame.height).toBeCloseTo(50, 6);
    expect(resizedFrame.centerX).toBeCloseTo(100, 6);
    expect(resizedFrame.centerY).toBeCloseTo(125, 6);
    expect(resized.rotation).toBeCloseTo(QUARTER_TURN, 10);
  });

  it("turns a stroke in place and orbits a group member about the group centre", () => {
    const rectangle = createRectangle(50, 75, 150, 125);
    const inPlace = createTransform();
    inPlace.originX = 100;
    inPlace.originY = 100;
    inPlace.targetX = 100;
    inPlace.targetY = 100;
    inPlace.angle = QUARTER_TURN;
    const turned = transformStroke(rectangle, inPlace);
    expect(turned.points).toEqual(rectangle.points);
    expect(turned.rotation).toBeCloseTo(QUARTER_TURN, 10);

    const aroundGroup = { ...inPlace, originX: 0, originY: 100, targetX: 0, targetY: 100 };
    const orbited = getAnnotationStrokeFrame(transformStroke(rectangle, aroundGroup));
    expect(orbited.centerX).toBeCloseTo(0, 6);
    expect(orbited.centerY).toBeCloseTo(200, 6);
  });

  it("mirrors the points and the turn when flipped across one axis", () => {
    const rectangle = createRectangle(50, 75, 150, 125, 0.4);
    const transform = createTransform();
    transform.originX = 100;
    transform.originY = 100;
    transform.targetX = 100;
    transform.targetY = 100;
    transform.scaleX = -1;
    const flipped = transformStroke(rectangle, transform);
    expect(flipped.rotation).toBeCloseTo(-0.4, 10);
    expect(flipped.points[0].x).toBeCloseTo(150, 10);
  });

  it("writes into the target's own points so a drag reuses them", () => {
    const rectangle = createRectangle(50, 75, 150, 125);
    const target = { ...rectangle, points: rectangle.points.map((point) => ({ ...point })) };
    const targetPoints = target.points;
    const firstPoint = target.points[0];
    transformAnnotationStroke(
      rectangle,
      getAnnotationStrokeFrame(rectangle),
      resize(getAnnotationStrokeFrame(rectangle), [-1, -1], [-10, -10]),
      target,
    );
    expect(target.points).toBe(targetPoints);
    expect(target.points[0]).toBe(firstPoint);
    expect(firstPoint.x).toBeCloseTo(40, 10);
    expect(rectangle.points[0].x).toBe(50);
  });

  it("returns every corner of a slanted item in an evenly scaled group when undone", () => {
    const rectangle = createRectangle(50, 75, 150, 125, EIGHTH_TURN);
    const groupFrame = createFrame({ centerX: 200, centerY: 150, width: 400, height: 300 });
    const grown = transformStroke(rectangle, resize(groupFrame, [1, 0], [400, 0], true));
    const grownFrame = { ...groupFrame, centerX: 400, width: 800, height: 600 };
    const restored = transformStroke(grown, resize(grownFrame, [1, 0], [-400, 0], true));
    restored.points.forEach((point, pointIndex) =>
      expectPointClose(point, rectangle.points[pointIndex]),
    );
    expect(restored.rotation).toBeCloseTo(EIGHTH_TURN, 10);
  });

  it("keeps each point's ink weight", () => {
    const stroke = { ...createRectangle(0, 0, 10, 10), isRectangle: false };
    stroke.points[1].weight = 0.9;
    const transform = resize(getAnnotationStrokeFrame(stroke), [1, 1], [10, 10]);
    expect(transformStroke(stroke, transform).points[1].weight).toBe(0.9);
  });
});

describe("transformAnnotationText", () => {
  it("scales a note evenly from the corner that was dragged", () => {
    const note = createNote();
    const frame = getAnnotationTextFrame(note, 40);
    const scaled = transformText(note, 40, resize(frame, [1, 1], [40, 20], true));
    expect(scaled.scale).toBeCloseTo(2, 10);
    const scaledFrame = getAnnotationTextFrame(scaled, 40);
    expect(scaledFrame.centerX - scaledFrame.width / 2).toBeCloseTo(100, 6);
    expect(scaledFrame.centerY - scaledFrame.height / 2).toBeCloseTo(100, 6);
  });

  it("turns a note about its centre without moving it", () => {
    const note = createNote();
    const transform = createTransform();
    transform.originX = 120;
    transform.originY = 110;
    transform.targetX = 120;
    transform.targetY = 110;
    transform.angle = 0.5;
    const turned = transformText(note, 40, transform);
    expect(turned.x).toBeCloseTo(note.x, 10);
    expect(turned.y).toBeCloseTo(note.y, 10);
    expect(turned.rotation).toBeCloseTo(0.5, 10);
  });

  it("never mirrors a note", () => {
    const note = createNote();
    const transform = createTransform();
    transform.originX = 120;
    transform.originY = 110;
    transform.targetX = 120;
    transform.targetY = 110;
    transform.scaleX = -1;
    transform.scaleY = -1;
    expect(transformText(note, 40, transform).scale).toBeCloseTo(1, 10);
  });
});
