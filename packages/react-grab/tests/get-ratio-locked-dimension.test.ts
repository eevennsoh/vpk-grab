import { describe, expect, it } from "vite-plus/test";
import { getRatioLockedDimension } from "../src/utils/get-ratio-locked-dimension.js";

const dimensions = {
  previousEditedSizePx: 200,
  previousPairedSizePx: 100,
  nextEditedSizePx: 300,
  currentPairedSizePx: 100,
  currentPairedCssSizePx: 100,
  pairedBorderBoxSizePx: 100,
};

describe("getRatioLockedDimension", () => {
  it("scales the paired border-box dimension", () => {
    expect(getRatioLockedDimension(dimensions)).toBe("150px");
    expect(
      getRatioLockedDimension({
        ...dimensions,
        previousEditedSizePx: 100,
        previousPairedSizePx: 200,
      }),
    ).toBe("600px");
  });

  it("subtracts padding and borders under content-box sizing", () => {
    expect(getRatioLockedDimension({ ...dimensions, currentPairedCssSizePx: 70 })).toBe("120px");
  });

  it("accounts for axis-aligned CSS scale", () => {
    expect(
      getRatioLockedDimension({
        ...dimensions,
        currentPairedCssSizePx: 50,
        pairedBorderBoxSizePx: 50,
      }),
    ).toBe("75px");
  });

  it("rounds pixels like the specs panel", () => {
    expect(getRatioLockedDimension({ ...dimensions, nextEditedSizePx: 266.666666 })).toBe(
      "133.33px",
    );
  });

  it("skips zero boxes, invalid measurements and nonpositive results", () => {
    for (const property of [
      "previousEditedSizePx",
      "previousPairedSizePx",
      "nextEditedSizePx",
      "currentPairedSizePx",
      "pairedBorderBoxSizePx",
    ]) {
      expect(getRatioLockedDimension({ ...dimensions, [property]: 0 })).toBeNull();
    }
    expect(getRatioLockedDimension({ ...dimensions, nextEditedSizePx: Number.NaN })).toBeNull();
    expect(
      getRatioLockedDimension({ ...dimensions, nextEditedSizePx: 1, currentPairedCssSizePx: 0 }),
    ).toBeNull();
  });
});
