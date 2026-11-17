import { describe, expect, it } from "vite-plus/test";
import { findNearestBoundsIndex } from "../src/utils/find-nearest-bounds-index.js";

const createBounds = (x: number, y: number, width: number, height: number) => ({
  borderRadius: "0px",
  x,
  y,
  width,
  height,
});

describe("findNearestBoundsIndex", () => {
  const boundsList = [createBounds(0, 0, 50, 20), createBounds(100, 0, 50, 20)];

  it("picks the bounds the position is inside", () => {
    expect(findNearestBoundsIndex(boundsList, { x: 120, y: 10 })).toBe(1);
  });

  it("picks the nearest edge, not the nearest center", () => {
    const wideAndNarrow = [createBounds(0, 0, 300, 20), createBounds(320, 0, 10, 20)];
    expect(findNearestBoundsIndex(wideAndNarrow, { x: 306, y: 10 })).toBe(0);
  });

  it("measures diagonal gaps from the corner", () => {
    expect(findNearestBoundsIndex(boundsList, { x: 80, y: 60 })).toBe(1);
  });

  it("keeps the first of equally near bounds", () => {
    expect(findNearestBoundsIndex(boundsList, { x: 75, y: 10 })).toBe(0);
  });

  it("returns -1 without bounds", () => {
    expect(findNearestBoundsIndex([], { x: 0, y: 0 })).toBe(-1);
  });
});
