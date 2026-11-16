import { describe, expect, it } from "vite-plus/test";
import { SCREENSHOT_MAX_EDGE_PX } from "../src/constants.js";
import { getScreenshotSize } from "../src/utils/get-screenshot-size.js";

describe("getScreenshotSize", () => {
  it("renders at the device pixel ratio while the longest edge fits", () => {
    expect(getScreenshotSize(300, 200, 2)).toEqual({
      scale: 2,
      pixelWidth: 600,
      pixelHeight: 400,
      outputScaleX: 2,
      outputScaleY: 2,
    });
  });

  it("never renders below one pixel per CSS pixel on low-density screens", () => {
    expect(getScreenshotSize(300, 200, 0.5)).toEqual({
      scale: 1,
      pixelWidth: 300,
      pixelHeight: 200,
      outputScaleX: 1,
      outputScaleY: 1,
    });
  });

  it("reduces the scale so the longest edge stays within the maximum", () => {
    const size = getScreenshotSize(1600, 400, 2);
    expect(size.scale).toBe(SCREENSHOT_MAX_EDGE_PX / 1600);
    expect(size.pixelWidth).toBe(SCREENSHOT_MAX_EDGE_PX);
    expect(size.pixelHeight).toBe(500);
  });

  it("caps a tall rectangle by its height", () => {
    const size = getScreenshotSize(100, 5000, 1);
    expect(size.pixelHeight).toBe(SCREENSHOT_MAX_EDGE_PX);
    expect(size.pixelWidth).toBe(40);
  });

  it("rounds to whole pixels and never returns an empty image", () => {
    expect(getScreenshotSize(10.4, 0.2, 1.5)).toEqual({
      scale: 1.5,
      pixelWidth: 16,
      pixelHeight: 1,
      outputScaleX: 16 / 10.4,
      outputScaleY: 5,
    });
  });

  it("gives each axis its own output scale once rounding makes them differ", () => {
    const size = getScreenshotSize(8, 5000, 1);
    expect(size.pixelWidth).toBe(3);
    expect(size.pixelHeight).toBe(SCREENSHOT_MAX_EDGE_PX);
    expect(size.outputScaleX).toBe(3 / 8);
    expect(size.outputScaleY).toBe(SCREENSHOT_MAX_EDGE_PX / 5000);
    expect(size.outputScaleX * 8).toBe(size.pixelWidth);
    expect(size.outputScaleY * 5000).toBe(size.pixelHeight);
  });
});
