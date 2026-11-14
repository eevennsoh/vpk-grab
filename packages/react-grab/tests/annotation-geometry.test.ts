import { describe, expect, it } from "vite-plus/test";
import type { AnnotationPoint, Rect } from "../src/types.js";
import { getAnnotationStrokeBounds } from "../src/utils/get-annotation-stroke-bounds.js";
import { getSpecsPanelCorner } from "../src/utils/get-specs-panel-corner.js";
import { createInkPath, getNextInkWeight, INK_NEUTRAL_WEIGHT } from "../src/utils/ink-path.js";
import { snapStraightLineEnd } from "../src/utils/snap-straight-line-end.js";

const point = (x: number, y: number): AnnotationPoint => ({ x, y, weight: INK_NEUTRAL_WEIGHT });

const getPathNumbers = (path: string): number[] =>
  (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("snapStraightLineEnd", () => {
  it("levels a line drawn almost horizontally", () => {
    expect(snapStraightLineEnd({ x: 0, y: 0 }, { x: 300, y: 8 })).toEqual({ x: 300, y: 0 });
  });

  it("straightens a line drawn almost vertically", () => {
    expect(snapStraightLineEnd({ x: 0, y: 0 }, { x: -5, y: 200 })).toEqual({ x: 0, y: 200 });
  });

  it("leaves a deliberate diagonal alone", () => {
    expect(snapStraightLineEnd({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual({ x: 100, y: 60 });
  });
});

describe("createInkPath", () => {
  it("returns nothing for no points", () => {
    expect(createInkPath([], 3)).toBe("");
  });

  it("draws a single point as a dot", () => {
    const path = createInkPath([point(10, 10)], 4);
    expect(path.startsWith("M8 10a2 2")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("gives a straight line one width end to end", () => {
    const path = createInkPath([point(0, 10), point(100, 10)], 4, true);
    const yValues = getPathNumbers(path.replaceAll(/A[\d. ]+? 0 0 0/g, "")).filter(
      (_, index) => index % 2 === 1,
    );
    expect(Math.min(...yValues)).toBe(8);
    expect(Math.max(...yValues)).toBe(12);
  });

  it("thins a freehand stroke toward its ends", () => {
    const points = Array.from({ length: 40 }, (_, index) => point(index * 5, 0));
    const freehandYValues = getPathNumbers(createInkPath(points, 4).split("L")[0]).filter(
      (_, index) => index % 2 === 1,
    );
    expect(Math.abs(freehandYValues[0])).toBeLessThan(1);
    expect(Math.max(...freehandYValues.map(Math.abs))).toBe(2);
  });
});

describe("getNextInkWeight", () => {
  it("lightens for a fast pointer and darkens for a slow one", () => {
    expect(getNextInkWeight(0.5, 100, 10)).toBeLessThan(0.5);
    expect(getNextInkWeight(0.5, 1, 100)).toBeGreaterThan(0.5);
  });

  it("follows stylus pressure when there is one", () => {
    expect(getNextInkWeight(0.5, 100, 10, 1)).toBeGreaterThan(0.5);
  });
});

describe("getSpecsPanelCorner", () => {
  const baseOptions = {
    viewportWidth: 1000,
    viewportHeight: 800,
    panelWidth: 270,
    panelHeight: 400,
    margin: 12,
    currentCorner: "top-right" as const,
    pointer: { x: 500, y: 600 },
    avoidRects: [] as Rect[],
  };

  it("stays put while its corner is clear", () => {
    expect(getSpecsPanelCorner({ ...baseOptions, currentCorner: "bottom-left" })).toBe(
      "bottom-left",
    );
  });

  it("moves away from the element being inspected", () => {
    const elementUnderPanel: Rect = { left: 800, top: 50, right: 900, bottom: 90 };
    expect(
      getSpecsPanelCorner({
        ...baseOptions,
        pointer: { x: 850, y: 70 },
        avoidRects: [elementUnderPanel],
      }),
    ).toBe("top-left");
  });

  it("never sits under the pointer", () => {
    const fullWidthElement: Rect = { left: 0, top: 0, right: 1000, bottom: 800 };
    expect(
      getSpecsPanelCorner({
        ...baseOptions,
        pointer: { x: 900, y: 100 },
        avoidRects: [fullWidthElement],
      }),
    ).toBe("top-left");
  });
});

describe("getAnnotationStrokeBounds", () => {
  it("wraps every point of the stroke, with room around it", () => {
    expect(
      getAnnotationStrokeBounds(
        [
          { x: 40, y: 90 },
          { x: 10, y: 120 },
          { x: 70, y: 60 },
        ],
        6,
      ),
    ).toEqual({ left: 4, top: 54, right: 76, bottom: 126 });
  });

  it("has nothing to wrap without points", () => {
    expect(getAnnotationStrokeBounds([], 6)).toBeNull();
  });
});
