import { createMemo, For, Show, type Component } from "solid-js";
import {
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  REDLINE_LABEL_HEIGHT_PX,
  REDLINE_TICK_LENGTH_PX,
  Z_INDEX_OVERLAY_CANVAS,
} from "../../constants.js";
import type { ElementRedlines, RedlineGuide, RedlineMeasurement } from "../../types.js";
import { getElementRedlines } from "../../utils/get-element-redlines.js";
import { getPairRedlines } from "../../utils/get-pair-redlines.js";

interface RedlinesOverlayProps {
  element: Element | null;
  measureTarget: Element | null;
  viewportVersion: number;
}

const LINE_THICKNESS_PX = 1;
const LABEL_GAP_PX = 4;
const SIZE_LABEL_CLEARANCE_PX = 120;

const formatPixels = (value: number): string => String(Math.round(value * 10) / 10);

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
const getLabelStyle = (measurement: RedlineMeasurement) => {
  const middleX = (measurement.start.x + measurement.end.x) / 2;
  const middleY = (measurement.start.y + measurement.end.y) / 2;
  return isHorizontal(measurement)
    ? {
        left: `${middleX}px`,
        top: `${middleY - LABEL_GAP_PX}px`,
        transform: "translate(-50%, -100%)",
      }
    : {
        left: `${middleX + LABEL_GAP_PX}px`,
        top: `${middleY}px`,
        transform: "translate(0, -50%)",
      };
};

const LABEL_CLASS =
  "absolute px-1 rounded-[3px] font-sans text-[10px] font-semibold tabular-nums whitespace-nowrap";

export const RedlinesOverlay: Component<RedlinesOverlayProps> = (props) => {
  // With a measure target the element's own spacing gives way to the
  // distances between the two; a target with no box to measure falls back.
  const redlines = createMemo(() => {
    void props.viewportVersion;
    const element = props.element;
    if (!element) return null;
    const measureTarget = props.measureTarget;
    const pairRedlines =
      measureTarget && measureTarget !== element ? getPairRedlines(element, measureTarget) : null;
    return pairRedlines ?? getElementRedlines(element);
  });

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
    const topAbove = bounds.y - REDLINE_LABEL_HEIGHT_PX - LABEL_GAP_PX;
    const top = `${topAbove >= 0 ? topAbove : bounds.y + LABEL_GAP_PX}px`;
    const isCrowdedByTopMeasurement =
      bounds.width < SIZE_LABEL_CLEARANCE_PX &&
      measurements.some((measurement) => measurement.side === "top");
    return isCrowdedByTopMeasurement && bounds.x >= SIZE_LABEL_CLEARANCE_PX
      ? { top, left: `${bounds.x - LABEL_GAP_PX}px`, transform: "translateX(-100%)" }
      : { top, left: `${bounds.x}px` };
  };

  return (
    <Show when={redlines()}>
      {(currentRedlines) => (
        <div
          data-react-grab-redlines
          aria-hidden="true"
          class="fixed top-0 left-0 pointer-events-none"
          style={{ "z-index": String(Z_INDEX_OVERLAY_CANVAS) }}
        >
          <div
            data-react-grab-redline-size
            class={LABEL_CLASS}
            style={{
              ...labelBaseStyle,
              ...sizeLabelStyle(currentRedlines()),
            }}
            textContent={`${formatPixels(currentRedlines().bounds.width)} × ${formatPixels(currentRedlines().bounds.height)}`}
          />
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
                  class={LABEL_CLASS}
                  style={{ ...labelBaseStyle, ...getLabelStyle(measurement) }}
                  textContent={formatPixels(measurement.distance)}
                />
              </>
            )}
          </For>
        </div>
      )}
    </Show>
  );
};
