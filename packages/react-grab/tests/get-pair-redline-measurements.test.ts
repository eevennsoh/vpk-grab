import { describe, expect, it } from "vite-plus/test";
import type { Rect } from "../src/types.js";
import { getPairRedlineMeasurements } from "../src/utils/get-pair-redline-measurements.js";

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const anchor = rect(200, 100, 100, 40);

const distancesBySide = (target: Rect) =>
  Object.fromEntries(
    getPairRedlineMeasurements(anchor, target).measurements.map((measurement) => [
      measurement.side,
      measurement.distance,
    ]),
  );

describe("getPairRedlineMeasurements", () => {
  it("measures the gap to a target beside the anchor through the stretch they share", () => {
    const beside = rect(340, 100, 60, 40);
    const { measurements, guides } = getPairRedlineMeasurements(anchor, beside);
    expect(measurements).toEqual([
      { side: "right", distance: 40, start: { x: 300, y: 120 }, end: { x: 340, y: 120 } },
    ]);
    expect(guides).toEqual([]);
  });

  it("measures the gap to a target above or below the anchor", () => {
    expect(distancesBySide(rect(200, 164, 100, 40))).toEqual({ bottom: 24 });
    expect(distancesBySide(rect(200, 20, 100, 40))).toEqual({ top: 40 });
  });

  it("measures both gaps to a diagonal target and carries the anchor's edges out to them", () => {
    const diagonal = rect(360, 200, 80, 60);
    const { measurements, guides } = getPairRedlineMeasurements(anchor, diagonal);
    expect(measurements).toEqual([
      { side: "right", distance: 60, start: { x: 300, y: 230 }, end: { x: 360, y: 230 } },
      { side: "bottom", distance: 60, start: { x: 400, y: 140 }, end: { x: 400, y: 200 } },
    ]);
    expect(guides).toEqual([
      { start: { x: 300, y: 140 }, end: { x: 300, y: 230 } },
      { start: { x: 300, y: 140 }, end: { x: 400, y: 140 } },
    ]);
  });

  it("measures edge to edge against a target that surrounds the anchor", () => {
    const surrounding = rect(180, 70, 160, 120);
    expect(distancesBySide(surrounding)).toEqual({ left: 20, right: 40, top: 30, bottom: 50 });
    expect(getPairRedlineMeasurements(anchor, surrounding).guides).toEqual([]);
  });

  it("measures edge to edge against a target inside the anchor", () => {
    expect(distancesBySide(rect(210, 108, 30, 24))).toEqual({
      left: 10,
      right: 60,
      top: 8,
      bottom: 8,
    });
  });

  it("measures how far the edges of a target beside the anchor are from the anchor's own", () => {
    const tallerBeside = rect(40, 80, 100, 200);
    const { measurements, guides } = getPairRedlineMeasurements(anchor, tallerBeside);
    expect(measurements).toEqual([
      { side: "left", distance: 60, start: { x: 200, y: 120 }, end: { x: 140, y: 120 } },
      { side: "top", distance: 20, start: { x: 90, y: 100 }, end: { x: 90, y: 80 } },
      { side: "bottom", distance: 140, start: { x: 90, y: 140 }, end: { x: 90, y: 280 } },
    ]);
    expect(guides).toEqual([
      { start: { x: 200, y: 100 }, end: { x: 90, y: 100 } },
      { start: { x: 200, y: 140 }, end: { x: 90, y: 140 } },
    ]);
  });

  it("draws nothing between edges that line up", () => {
    expect(distancesBySide(rect(200, 164, 100, 40))).toEqual({ bottom: 24 });
    expect(distancesBySide(rect(300, 100, 50, 40))).toEqual({});
  });

  it("treats a sub-pixel overlap as touching rather than as one box inside the other", () => {
    expect(distancesBySide(rect(299.7, 100, 50, 40))).toEqual({});
  });
});
