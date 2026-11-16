import { describe, expect, it } from "vite-plus/test";
import { SCREENSHOT_MAX_EDGE_PX } from "../src/constants.js";
import { getScreenshotSize } from "../src/utils/get-screenshot-size.js";

describe("getScreenshotSize", () => {
  it("renders at the device pixel ratio while the longest edge fits", () => {
    expect(getScreenshotSize(300, 200, 2)).toEqual({ scale: 2, pixelWidth: 600, pixelHeight: 400 });
  });

  it("never renders below one pixel per CSS pixel on low-density screens", () => {
    expect(getScreenshotSize(300, 200, 0.5)).toEqual({
      scale: 1,
      pixelWidth: 300,
      pixelHeight: 200,
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
    });
  });
});
