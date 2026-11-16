import { describe, expect, it } from "vite-plus/test";
import { getScreenshotFileName } from "../src/utils/get-screenshot-file-name.js";

describe("getScreenshotFileName", () => {
  it("names the file after the local date and time", () => {
    expect(getScreenshotFileName(new Date(2026, 10, 16, 9, 5, 7))).toBe(
      "vpk-grab-2026-11-16-090507.png",
    );
  });

  it("pads every field to two digits", () => {
    expect(getScreenshotFileName(new Date(2027, 0, 1, 23, 59, 0))).toBe(
      "vpk-grab-2027-01-01-235900.png",
    );
  });
});
