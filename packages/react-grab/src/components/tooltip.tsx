import { createSignal, createEffect, For, on, onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import { cn } from "../utils/cn.js";
import { getContainmentShift } from "../utils/get-containment-shift.js";
import { getVisualViewport } from "../utils/get-visual-viewport.js";
import { splitShortcutAtCommand } from "../utils/split-shortcut-at-command.js";
import {
  TOOLTIP_DELAY_MS,
  TOOLTIP_GRACE_PERIOD_MS,
  VIEWPORT_MARGIN_PX,
  Z_INDEX_OVERLAY,
} from "../constants.js";
import { IconCommand } from "./icons/icon-command.jsx";

let lastCloseTimestamp = 0;

const wasTooltipRecentlyVisible = () => {
  return Date.now() - lastCloseTimestamp < TOOLTIP_GRACE_PERIOD_MS;
};

interface TooltipProps {
  id: string;
  visible: boolean;
  position: "top" | "bottom" | "left" | "right";
  textContent: string;
  shortcut?: string;
  anchorRightPx?: number;
  shouldStayInViewport?: boolean;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  const [delayedVisible, setDelayedVisible] = createSignal(false);
  const [shouldAnimate, setShouldAnimate] = createSignal(true);
  const [containmentShiftX, setContainmentShiftX] = createSignal(0);
  const [containmentShiftY, setContainmentShiftY] = createSignal(0);
  let tooltipRef: HTMLDivElement | undefined;
  let delayTimeoutId: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(
      () => props.visible,
      (isVisible) => {
        if (delayTimeoutId !== undefined) {
          clearTimeout(delayTimeoutId);
          delayTimeoutId = undefined;
        }

        if (isVisible) {
          // Reopening within the grace period skips the delay and the fade so
          // moving between adjacent buttons reads as one continuous tooltip.
          if (wasTooltipRecentlyVisible()) {
            setShouldAnimate(false);
            setDelayedVisible(true);
          } else {
            setShouldAnimate(true);
            delayTimeoutId = setTimeout(() => {
              setDelayedVisible(true);
            }, TOOLTIP_DELAY_MS);
          }
        } else {
          if (delayedVisible()) {
            lastCloseTimestamp = Date.now();
          }
          setDelayedVisible(false);
        }
      },
    ),
  );

  // The position props only pick a side, so the rendered box is measured and
  // shifted back inside the viewport. offsetWidth/offsetHeight ignore the
  // fade-in scale, which would otherwise shrink the measured box.
  createEffect(
    on(
      [
        delayedVisible,
        () => props.position,
        () => props.anchorRightPx,
        () => props.textContent,
        () => props.shortcut,
      ],
      ([isVisible]) => {
        if (!props.shouldStayInViewport || !isVisible || !tooltipRef) return;
        const rect = tooltipRef.getBoundingClientRect();
        const width = tooltipRef.offsetWidth;
        const height = tooltipRef.offsetHeight;
        const viewport = getVisualViewport();
        const unshiftedLeft = rect.left + rect.width / 2 - width / 2 - containmentShiftX();
        const unshiftedTop = rect.top + rect.height / 2 - height / 2 - containmentShiftY();
        setContainmentShiftX(
          getContainmentShift(
            unshiftedLeft,
            width,
            viewport.offsetLeft + VIEWPORT_MARGIN_PX,
            viewport.offsetLeft + viewport.width - VIEWPORT_MARGIN_PX,
          ),
        );
        setContainmentShiftY(
          getContainmentShift(
            unshiftedTop,
            height,
            viewport.offsetTop + VIEWPORT_MARGIN_PX,
            viewport.offsetTop + viewport.height - VIEWPORT_MARGIN_PX,
          ),
        );
      },
    ),
  );

  onCleanup(() => {
    if (delayTimeoutId !== undefined) {
      clearTimeout(delayTimeoutId);
    }
    if (delayedVisible()) {
      lastCloseTimestamp = Date.now();
    }
  });

  const positionStyle = (): Record<string, string> => {
    const isHorizontal = props.position === "top" || props.position === "bottom";
    const shiftX = `${containmentShiftX()}px`;
    const shiftY = `${containmentShiftY()}px`;
    if (isHorizontal && props.anchorRightPx !== undefined) {
      return {
        right: `${props.anchorRightPx}px`,
        translate: `${shiftX} ${shiftY}`,
        "z-index": `${Z_INDEX_OVERLAY}`,
      };
    }
    if (isHorizontal) {
      return {
        left: "50%",
        translate: `calc(-50% + ${shiftX}) ${shiftY}`,
        "z-index": `${Z_INDEX_OVERLAY}`,
      };
    }
    return {
      top: "50%",
      translate: `${shiftX} calc(-50% + ${shiftY})`,
      "z-index": `${Z_INDEX_OVERLAY}`,
    };
  };

  return (
    <Show when={delayedVisible()}>
      <div
        ref={tooltipRef}
        id={props.id}
        role="tooltip"
        data-react-grab-tooltip
        class={cn(
          "absolute flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-sans font-medium leading-4 pointer-events-none",
          "bg-[var(--rg-panel-bg)] text-[var(--rg-text-primary)] [box-shadow:var(--rg-shadow)]",
          props.position === "top" && "bottom-full mb-2.5",
          props.position === "bottom" && "top-full mt-2.5",
          props.position === "left" && "right-full mr-2.5",
          props.position === "right" && "left-full ml-2.5",
          shouldAnimate() && "animate-tooltip-fade-in",
        )}
        style={positionStyle()}
      >
        <span textContent={props.textContent} />
        <Show when={props.shortcut}>
          {(shortcut) => (
            <kbd
              data-react-grab-tooltip-shortcut={shortcut()}
              aria-label={shortcut()}
              class="inline-flex shrink-0 items-center gap-[2px] font-sans text-[10px] leading-none text-[var(--rg-text-secondary)]"
            >
              <For each={splitShortcutAtCommand(shortcut())}>
                {(part, partIndex) => (
                  <>
                    <Show when={partIndex() > 0}>
                      <IconCommand size={8} />
                    </Show>
                    <Show when={part}>
                      <span textContent={part} />
                    </Show>
                  </>
                )}
              </For>
            </kbd>
          )}
        </Show>
      </div>
    </Show>
  );
};
