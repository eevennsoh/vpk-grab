import { PAUSE_CHIP_GAP_PX, PAUSE_CHIP_SLIDE_PX } from "../constants.js";
import type { SnapEdge } from "../components/toolbar/state.js";
import type { PauseChipAnchor, PauseChipPlacement } from "../types.js";

export const getPauseChipPlacement = (
  edge: SnapEdge,
  anchor: PauseChipAnchor,
): PauseChipPlacement => {
  const centerX = anchor.x + anchor.width / 2;
  const centerY = anchor.y + anchor.height / 2;
  switch (edge) {
    case "top":
      return {
        left: centerX,
        top: anchor.y + anchor.height + PAUSE_CHIP_GAP_PX,
        translate: "-50% 0",
        hiddenTransform: `translateY(-${PAUSE_CHIP_SLIDE_PX}px)`,
      };
    case "left":
      return {
        left: anchor.x + anchor.width + PAUSE_CHIP_GAP_PX,
        top: centerY,
        translate: "0 -50%",
        hiddenTransform: `translateX(-${PAUSE_CHIP_SLIDE_PX}px)`,
      };
    case "right":
      return {
        left: anchor.x - PAUSE_CHIP_GAP_PX,
        top: centerY,
        translate: "-100% -50%",
        hiddenTransform: `translateX(${PAUSE_CHIP_SLIDE_PX}px)`,
      };
    default:
      return {
        left: centerX,
        top: anchor.y - PAUSE_CHIP_GAP_PX,
        translate: "-50% -100%",
        hiddenTransform: `translateY(${PAUSE_CHIP_SLIDE_PX}px)`,
      };
  }
};
