import { describe, expect, it } from "vite-plus/test";
import type { AnnotationPoint } from "../src/types.js";
import { updateRectanglePoints } from "../src/utils/update-rectangle-points.js";

const createPoints = (): AnnotationPoint[] =>
  Array.from({ length: 4 }, () => ({ x: 100, y: 100, weight: 0.5 }));

describe("updateRectanglePoints", () => {
  it("updates the existing corners in place in either direction", () => {
    const points = createPoints();
    const originalPoints = [...points];
    updateRectanglePoints(points, 240, 180, false);
    expect(points.map((point) => [point.x, point.y])).toEqual([
      [100, 100],
      [240, 100],
      [240, 180],
      [100, 180],
    ]);
    updateRectanglePoints(points, 40, 20, false);
    expect(points.map((point) => [point.x, point.y])).toEqual([
      [100, 100],
      [40, 100],
      [40, 20],
      [100, 20],
    ]);
    for (const [index, point] of points.entries()) expect(point).toBe(originalPoints[index]);
  });

  it("constrains to the larger dimension in every quadrant, including an axis", () => {
    for (const [pageX, pageY, expectedX, expectedY] of [
      [240, 180, 240, 240],
      [40, 20, 20, 20],
      [240, 20, 240, -40],
      [40, 180, 20, 180],
      [100, 180, 180, 180],
    ]) {
      const points = createPoints();
      updateRectanglePoints(points, pageX, pageY, true);
      expect(points[2]).toEqual({ x: expectedX, y: expectedY, weight: 0.5 });
    }
  });

  it("removes the constraint using the original press point", () => {
    const points = createPoints();
    updateRectanglePoints(points, 240, 180, true);
    updateRectanglePoints(points, 240, 180, false);
    expect(points[2]).toEqual({ x: 240, y: 180, weight: 0.5 });
  });
});
