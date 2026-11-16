import type { Component } from "solid-js";
import {
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  SCREENSHOT_SIZE_READOUT_OFFSET_PX,
  Z_INDEX_OVERLAY_CANVAS,
} from "../constants.js";
import type { OverlayBounds } from "../types.js";

interface ScreenshotMarqueeProps {
  bounds: OverlayBounds;
}

export const ScreenshotMarquee: Component<ScreenshotMarqueeProps> = (props) => (
  <div
    data-react-grab-screenshot-marquee
    aria-hidden="true"
    class="fixed pointer-events-none"
    style={{
      left: `${props.bounds.x}px`,
      top: `${props.bounds.y}px`,
      width: `${props.bounds.width}px`,
      height: `${props.bounds.height}px`,
      border: `1px dashed ${INSPECT_ACCENT_COLOR}`,
      "box-shadow": `0 0 0 1px ${INSPECT_ACCENT_CONTRAST_COLOR}`,
      "z-index": String(Z_INDEX_OVERLAY_CANVAS),
    }}
  >
    <span
      data-react-grab-screenshot-size
      class="absolute whitespace-nowrap rounded-[3px] px-1 font-sans text-[11px] leading-4 font-medium tabular-nums"
      style={{
        right: "0px",
        top: `calc(100% + ${SCREENSHOT_SIZE_READOUT_OFFSET_PX}px)`,
        color: INSPECT_ACCENT_CONTRAST_COLOR,
        "background-color": INSPECT_ACCENT_COLOR,
      }}
      textContent={`${Math.round(props.bounds.width)} × ${Math.round(props.bounds.height)}`}
    />
  </div>
);
