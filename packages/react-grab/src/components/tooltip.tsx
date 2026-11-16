import { createSignal, createEffect, on, onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import { cn } from "../utils/cn.js";
import { TOOLTIP_DELAY_MS, TOOLTIP_GRACE_PERIOD_MS, Z_INDEX_OVERLAY } from "../constants.js";

let lastCloseTimestamp = 0;

const wasTooltipRecentlyVisible = () => {
  return Date.now() - lastCloseTimestamp < TOOLTIP_GRACE_PERIOD_MS;
};

interface TooltipProps {
  visible: boolean;
  position: "top" | "bottom" | "left" | "right";
  textContent: string;
  shortcut?: string;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  const [delayedVisible, setDelayedVisible] = createSignal(false);
  const [shouldAnimate, setShouldAnimate] = createSignal(true);
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
    if (isHorizontal) {
      return { left: "50%", translate: "-50%", "z-index": `${Z_INDEX_OVERLAY}` };
    }
    return { top: "50%", translate: "0 -50%", "z-index": `${Z_INDEX_OVERLAY}` };
  };

  return (
    <Show when={delayedVisible()}>
      <div
        data-react-grab-tooltip
        class={cn(
          "absolute flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-sans font-medium leading-4 pointer-events-none",
          // A 14px key cap in the 20px-tall tooltip leaves 3px above and below
          // it; the same 3px on its right keeps the circle evenly inset.
          props.shortcut && "pr-[3px]",
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
              data-react-grab-tooltip-shortcut
              class="flex h-[14px] min-w-[14px] shrink-0 items-center justify-center rounded-full px-[3px] bg-[var(--rg-surface-hover)] font-mono text-[10px] leading-none text-[var(--rg-text-secondary)]"
              textContent={shortcut()}
            />
          )}
        </Show>
      </div>
    </Show>
  );
};
