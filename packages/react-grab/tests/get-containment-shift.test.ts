import { describe, expect, it } from "vite-plus/test";
import { getContainmentShift } from "../src/utils/get-containment-shift.js";

describe("getContainmentShift", () => {
  it("leaves a box that already fits where it is", () => {
    expect(getContainmentShift(20, 70, 8, 312)).toBe(0);
  });

  it("pulls a box past the start edge back to the boundary", () => {
    expect(getContainmentShift(-30, 70, 8, 312)).toBe(38);
  });

  it("pulls a box past the end edge back to the boundary", () => {
    expect(getContainmentShift(280, 70, 8, 312)).toBe(-38);
  });

  it("keeps the start edge visible when the box is larger than the boundary", () => {
    expect(getContainmentShift(-10, 400, 8, 312)).toBe(18);
    expect(getContainmentShift(100, 400, 8, 312)).toBe(-92);
  });
});
