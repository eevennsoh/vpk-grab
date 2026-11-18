import { describe, expect, it } from "vite-plus/test";
import type { AnnotationStroke, AnnotationText, Rect } from "../src/types.js";
import { filterAnnotationsInRect } from "../src/utils/filter-annotations-in-rect.js";

const CAPTURE_RECT: Rect = { left: 100, top: 100, right: 300, bottom: 200 };
const TEXT_WIDTH_PX = 50;

const createStroke = (id: string, points: Array<[number, number]>): AnnotationStroke => ({
  id,
  points: points.map(([x, y]) => ({ x, y, weight: 0.5 })),
  isStraight: false,
  isRectangle: false,
  color: "#ff0000",
});

const createText = (id: string, x: number, y: number): AnnotationText => ({
  id,
  x,
  y,
  text: "note",
  color: "#ff0000",
});

const measureTextWidth = () => TEXT_WIDTH_PX;

describe("filterAnnotationsInRect", () => {
  it("keeps strokes that cross the rectangle and drops the rest", () => {
    const crossing = createStroke("crossing", [
      [50, 150],
      [150, 150],
    ]);
    const inside = createStroke("inside", [
      [120, 120],
      [130, 130],
    ]);
    const outside = createStroke("outside", [
      [400, 400],
      [450, 450],
    ]);

    const result = filterAnnotationsInRect(
      { strokes: [crossing, inside, outside], texts: [] },
      CAPTURE_RECT,
      measureTextWidth,
    );

    expect(result.strokes.map((stroke) => stroke.id)).toEqual(["crossing", "inside"]);
  });

  it("counts a stroke's ink width, so one just outside the edge still shows", () => {
    const grazing = createStroke("grazing", [
      [150, 98],
      [200, 98],
    ]);

    const result = filterAnnotationsInRect(
      { strokes: [grazing], texts: [] },
      CAPTURE_RECT,
      measureTextWidth,
    );

    expect(result.strokes).toHaveLength(1);
  });

  it("drops strokes without points", () => {
    const result = filterAnnotationsInRect(
      { strokes: [createStroke("empty", [])], texts: [] },
      CAPTURE_RECT,
      measureTextWidth,
    );

    expect(result.strokes).toHaveLength(0);
  });

  it("keeps a note whose measured box reaches into the rectangle", () => {
    const startsLeftOfRect = createText("starts-left", 60, 150);
    const aboveRect = createText("above", 150, 80);
    const touchesTopEdge = createText("touches-top", 150, 92);
    const rightOfRect = createText("right", 320, 150);

    const result = filterAnnotationsInRect(
      { strokes: [], texts: [startsLeftOfRect, aboveRect, touchesTopEdge, rightOfRect] },
      CAPTURE_RECT,
      measureTextWidth,
    );

    expect(result.texts.map((annotationText) => annotationText.id)).toEqual([
      "starts-left",
      "touches-top",
    ]);
  });
});
