import { describe, expect, it } from "vite-plus/test";
import type { Rect } from "../src/types.js";
import { getRedlineMeasurements } from "../src/utils/get-redline-measurements.js";

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const container = rect(0, 0, 400, 200);
const target = rect(150, 50, 100, 100);

const distancesBySide = (siblings: Rect[], containerRect: Rect | null = container) =>
  Object.fromEntries(
    getRedlineMeasurements(target, siblings, containerRect).map((measurement) => [
      measurement.side,
      measurement.distance,
    ]),
  );

describe("getRedlineMeasurements", () => {
  it("measures to the container's inside edge when nothing is in between", () => {
    expect(distancesBySide([])).toEqual({ top: 50, right: 150, bottom: 50, left: 150 });
  });

  it("measures to the nearest sibling on a side instead of the container", () => {
    const nearLeft = rect(100, 50, 34, 100);
    const farLeft = rect(20, 50, 30, 100);
    expect(distancesBySide([farLeft, nearLeft]).left).toBe(16);
  });

  it("ignores a sibling that does not line up on the other axis", () => {
    const belowAndLeft = rect(20, 160, 30, 30);
    expect(distancesBySide([belowAndLeft]).left).toBe(150);
  });

  it("draws nothing on a side where a sibling touches the target", () => {
    const touchingRight = rect(250, 50, 50, 100);
    expect(distancesBySide([touchingRight])).toEqual({ top: 50, bottom: 50, left: 150 });
  });

  it("skips siblings that overlap the target", () => {
    const overlapping = rect(140, 60, 50, 50);
    expect(distancesBySide([overlapping]).left).toBe(150);
  });

  it("draws nothing when the target is flush with the container", () => {
    expect(distancesBySide([], rect(150, 50, 100, 100))).toEqual({});
  });

  it("returns no container measurements without a container", () => {
    expect(distancesBySide([], null)).toEqual({});
  });

  it("runs the line through the stretch the target and sibling share", () => {
    const shortSibling = rect(20, 50, 30, 20);
    const [leftMeasurement] = getRedlineMeasurements(target, [shortSibling], null);
    expect(leftMeasurement).toEqual({
      side: "left",
      distance: 100,
      start: { x: 150, y: 70 },
      end: { x: 50, y: 70 },
    });
  });
});
