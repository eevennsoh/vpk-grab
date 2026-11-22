import { describe, expect, it } from "vite-plus/test";
import { PAUSE_CHIP_GAP_PX, PAUSE_CHIP_SLIDE_PX } from "../src/constants.js";
import { getPauseChipPlacement } from "../src/utils/get-pause-chip-placement.js";

const TOOLBAR_ANCHOR = { x: 100, y: 500, width: 200, height: 40 };

describe("getPauseChipPlacement", () => {
  it("puts the chip above a toolbar on the bottom edge and slides it up into place", () => {
    expect(getPauseChipPlacement("bottom", TOOLBAR_ANCHOR)).toEqual({
      left: 200,
      top: 500 - PAUSE_CHIP_GAP_PX,
      translate: "-50% -100%",
      hiddenTransform: `translateY(${PAUSE_CHIP_SLIDE_PX}px)`,
    });
  });

  it("puts the chip below a toolbar on the top edge", () => {
    expect(getPauseChipPlacement("top", TOOLBAR_ANCHOR)).toEqual({
      left: 200,
      top: 540 + PAUSE_CHIP_GAP_PX,
      translate: "-50% 0",
      hiddenTransform: `translateY(-${PAUSE_CHIP_SLIDE_PX}px)`,
    });
  });

  it("puts the chip left of a toolbar docked on the right edge, centred on it", () => {
    expect(getPauseChipPlacement("right", TOOLBAR_ANCHOR)).toEqual({
      left: 100 - PAUSE_CHIP_GAP_PX,
      top: 520,
      translate: "-100% -50%",
      hiddenTransform: `translateX(${PAUSE_CHIP_SLIDE_PX}px)`,
    });
  });

  it("puts the chip right of a toolbar docked on the left edge", () => {
    expect(getPauseChipPlacement("left", TOOLBAR_ANCHOR)).toEqual({
      left: 300 + PAUSE_CHIP_GAP_PX,
      top: 520,
      translate: "0 -50%",
      hiddenTransform: `translateX(-${PAUSE_CHIP_SLIDE_PX}px)`,
    });
  });
});
