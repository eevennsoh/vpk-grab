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

  it("counts either source while the tracker is unchanged", () => {
    expect(resolveHeldModifier(false, false, true)).toBe(true);
    expect(resolveHeldModifier(true, true, false)).toBe(true);
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
    expectPointClose(transformFramePoint(20, 0, transform), { x: 10, y: 20 });
  });
});

describe("getItemAxisScale", () => {
  it("is exact for an item square to its group and evens out at a slant", () => {
    expect(getItemAxisScale(2, 1, 0, false)).toBeCloseTo(2, 10);
    expect(getItemAxisScale(2, 1, QUARTER_TURN, false)).toBeCloseTo(1, 10);
    expect(getItemAxisScale(2, 1, QUARTER_TURN, true)).toBeCloseTo(2, 10);
    expect(getItemAxisScale(3, 3, 0.7, true)).toBeCloseTo(3, 10);
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
    const resized = transformAnnotationStroke(rectangle, transform);
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
    const resized = transformAnnotationStroke(rectangle, resize(frame, [1, 0], [0, 50]));
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
    const turned = transformAnnotationStroke(rectangle, inPlace);
    expect(turned.points).toEqual(rectangle.points);
    expect(turned.rotation).toBeCloseTo(QUARTER_TURN, 10);

    const aroundGroup = { ...inPlace, originX: 0, originY: 100, targetX: 0, targetY: 100 };
    const orbited = getAnnotationStrokeFrame(transformAnnotationStroke(rectangle, aroundGroup));
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
    const flipped = transformAnnotationStroke(rectangle, transform);
    expect(flipped.rotation).toBeCloseTo(-0.4, 10);
    expect(flipped.points[0].x).toBeCloseTo(150, 10);
  });

  it("keeps each point's ink weight", () => {
    const stroke = { ...createRectangle(0, 0, 10, 10), isRectangle: false };
    stroke.points[1].weight = 0.9;
    const transform = resize(getAnnotationStrokeFrame(stroke), [1, 1], [10, 10]);
    expect(transformAnnotationStroke(stroke, transform).points[1].weight).toBe(0.9);
  });
});

describe("transformAnnotationText", () => {
  it("scales a note evenly from the corner that was dragged", () => {
    const note = createNote();
    const frame = getAnnotationTextFrame(note, 40);
    const scaled = transformAnnotationText(note, 40, resize(frame, [1, 1], [40, 20], true));
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
    const turned = transformAnnotationText(note, 40, transform);
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
    expect(transformAnnotationText(note, 40, transform).scale).toBeCloseTo(1, 10);
  });
});
