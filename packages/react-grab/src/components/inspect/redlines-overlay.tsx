import { For, Show, type Component } from "solid-js";
import {
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  REDLINE_LABEL_GAP_PX,
  REDLINE_LABEL_HEIGHT_PX,
  REDLINE_TICK_LENGTH_PX,
  Z_INDEX_OVERLAY_CANVAS,
} from "../../constants.js";
import type { ElementRedlines, RedlineGuide, RedlineMeasurement } from "../../types.js";
import { formatElementSize } from "../../utils/format-element-size.js";
import { formatPixels } from "../../utils/format-pixels.js";
import { isCompactRedlineElement } from "../../utils/is-compact-redline-element.js";

interface RedlinesOverlayProps {
  redlines: ElementRedlines;
  showsSizeLabel: boolean;
}

const LINE_THICKNESS_PX = 1;
const SIZE_LABEL_CLEARANCE_PX = 120;

const isHorizontal = (measurement: RedlineMeasurement): boolean =>
  measurement.start.y === measurement.end.y;

const getLineStyle = (measurement: RedlineMeasurement) => {
  const left = Math.min(measurement.start.x, measurement.end.x);
  const top = Math.min(measurement.start.y, measurement.end.y);
  return isHorizontal(measurement)
    ? {
        left: `${left}px`,
        top: `${top - LINE_THICKNESS_PX / 2}px`,
        width: `${measurement.distance}px`,
        height: `${LINE_THICKNESS_PX}px`,
      }
    : {
        left: `${left - LINE_THICKNESS_PX / 2}px`,
        top: `${top}px`,
        width: `${LINE_THICKNESS_PX}px`,
        height: `${measurement.distance}px`,
      };
};

const getTickStyle = (measurement: RedlineMeasurement, end: "start" | "end") => {
  const point = measurement[end];
  return isHorizontal(measurement)
    ? {
        left: `${point.x - LINE_THICKNESS_PX / 2}px`,
        top: `${point.y - REDLINE_TICK_LENGTH_PX / 2}px`,
        width: `${LINE_THICKNESS_PX}px`,
        height: `${REDLINE_TICK_LENGTH_PX}px`,
      }
    : {
        left: `${point.x - REDLINE_TICK_LENGTH_PX / 2}px`,
        top: `${point.y - LINE_THICKNESS_PX / 2}px`,
        width: `${REDLINE_TICK_LENGTH_PX}px`,
        height: `${LINE_THICKNESS_PX}px`,
      };
};

const getGuideStyle = (guide: RedlineGuide) => {
  const left = Math.min(guide.start.x, guide.end.x);
  const top = Math.min(guide.start.y, guide.end.y);
  const dashedBorder = `${LINE_THICKNESS_PX}px dashed ${INSPECT_ACCENT_COLOR}`;
  return guide.start.y === guide.end.y
    ? {
        left: `${left}px`,
        top: `${top - LINE_THICKNESS_PX / 2}px`,
        width: `${Math.abs(guide.end.x - guide.start.x)}px`,
        "border-top": dashedBorder,
      }
    : {
        left: `${left - LINE_THICKNESS_PX / 2}px`,
        top: `${top}px`,
        height: `${Math.abs(guide.end.y - guide.start.y)}px`,
        "border-left": dashedBorder,
      };
};

// Beside the line rather than on it, so a 4px gap is not hidden by its own label.
const getMiddleLabelStyle = (measurement: RedlineMeasurement) => {
  const middleX = (measurement.start.x + measurement.end.x) / 2;
  const middleY = (measurement.start.y + measurement.end.y) / 2;
  return isHorizontal(measurement)
    ? {
        left: `${middleX}px`,
        top: `${middleY - REDLINE_LABEL_GAP_PX}px`,
        transform: "translate(-50%, -100%)",
      }
    : {
        left: `${middleX + REDLINE_LABEL_GAP_PX}px`,
        top: `${middleY}px`,
        transform: "translate(0, -50%)",
      };
};

// Around a small element the middles of its lines sit a few pixels apart and
// their labels pile up. Past each line's far tick instead, the four labels
// grow away from the element in four directions and cannot meet.
const getOuterLabelStyle = (measurement: RedlineMeasurement) => {
  const minimumX = Math.min(measurement.start.x, measurement.end.x);
  const maximumX = Math.max(measurement.start.x, measurement.end.x);
  const minimumY = Math.min(measurement.start.y, measurement.end.y);
  const maximumY = Math.max(measurement.start.y, measurement.end.y);
  switch (measurement.side) {
    case "top":
      return {
        left: `${minimumX}px`,
        top: `${minimumY - REDLINE_LABEL_GAP_PX}px`,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        left: `${minimumX}px`,
        top: `${maximumY + REDLINE_LABEL_GAP_PX}px`,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        left: `${minimumX - REDLINE_LABEL_GAP_PX}px`,
        top: `${minimumY}px`,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        left: `${maximumX + REDLINE_LABEL_GAP_PX}px`,
        top: `${minimumY}px`,
        transform: "translate(0, -50%)",
      };
    default: {
      const unhandledSide: never = measurement.side;
      return unhandledSide;
    }
  }
};

const LABEL_CLASS =
  "absolute px-1 rounded-[3px] font-sans text-[10px] font-semibold tabular-nums whitespace-nowrap";

export const RedlinesOverlay: Component<RedlinesOverlayProps> = (props) => {
  const labelBaseStyle = {
    height: `${REDLINE_LABEL_HEIGHT_PX}px`,
    "line-height": `${REDLINE_LABEL_HEIGHT_PX}px`,
    "background-color": INSPECT_ACCENT_COLOR,
    color: INSPECT_ACCENT_CONTRAST_COLOR,
  };

  // Above the top-left corner; an element too narrow to share its top edge
  // with the label of a top measurement gets the size off its corner instead.
  const sizeLabelStyle = (currentRedlines: ElementRedlines) => {
    const { bounds, measurements } = currentRedlines;
    const topAbove = bounds.y - REDLINE_LABEL_HEIGHT_PX - REDLINE_LABEL_GAP_PX;
    const top = `${topAbove >= 0 ? topAbove : bounds.y + REDLINE_LABEL_GAP_PX}px`;
    const isCrowdedByTopMeasurement =
      bounds.width < SIZE_LABEL_CLEARANCE_PX &&
      measurements.some((measurement) => measurement.side === "top");
    return isCrowdedByTopMeasurement && bounds.x >= SIZE_LABEL_CLEARANCE_PX
      ? { top, left: `${bounds.x - REDLINE_LABEL_GAP_PX}px`, transform: "translateX(-100%)" }
      : { top, left: `${bounds.x}px` };
  };

  const currentRedlines = () => props.redlines;
  const labelPlacement = () => (isCompactRedlineElement(props.redlines) ? "outer" : "middle");

  return (
    <div
      data-react-grab-redlines
      aria-hidden="true"
      class="fixed top-0 left-0 pointer-events-none"
      style={{ "z-index": String(Z_INDEX_OVERLAY_CANVAS) }}
    >
      <Show when={props.showsSizeLabel}>
        <div
          data-react-grab-redline-size
          class={LABEL_CLASS}
          style={{
            ...labelBaseStyle,
            ...sizeLabelStyle(currentRedlines()),
          }}
          textContent={formatElementSize(
            currentRedlines().bounds.width,
            currentRedlines().bounds.height,
          )}
        />
      </Show>
      <Show when={currentRedlines().targetBounds}>
        {(targetBounds) => (
          <div
            data-react-grab-redline-target
            class="absolute box-border"
            style={{
              left: `${targetBounds().x}px`,
              top: `${targetBounds().y}px`,
              width: `${targetBounds().width}px`,
              height: `${targetBounds().height}px`,
              border: `${LINE_THICKNESS_PX}px solid ${INSPECT_ACCENT_COLOR}`,
            }}
          />
        )}
      </Show>
      <For each={currentRedlines().guides}>
        {(guide) => (
          <div data-react-grab-redline-guide class="absolute" style={getGuideStyle(guide)} />
        )}
      </For>
      <For each={currentRedlines().measurements}>
        {(measurement) => (
          <>
            <div
              class="absolute"
              style={{ ...getLineStyle(measurement), "background-color": INSPECT_ACCENT_COLOR }}
            />
            <div
              class="absolute"
              style={{
                ...getTickStyle(measurement, "start"),
                "background-color": INSPECT_ACCENT_COLOR,
              }}
            />
            <div
              class="absolute"
              style={{
                ...getTickStyle(measurement, "end"),
                "background-color": INSPECT_ACCENT_COLOR,
              }}
            />
            <div
              data-react-grab-redline={measurement.side}
              data-react-grab-redline-placement={labelPlacement()}
              class={LABEL_CLASS}
              style={{
                ...labelBaseStyle,
                ...(labelPlacement() === "outer"
                  ? getOuterLabelStyle(measurement)
                  : getMiddleLabelStyle(measurement)),
              }}
              textContent={formatPixels(measurement.distance)}
            />
          </>
        )}
      </For>
    </div>
  );
};
