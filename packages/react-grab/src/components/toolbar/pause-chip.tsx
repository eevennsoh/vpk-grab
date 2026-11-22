import type { Component } from "solid-js";
import type { PauseChipAnchor } from "../../types.js";
import type { SnapEdge } from "./state.js";
import { getPauseChipPlacement } from "../../utils/get-pause-chip-placement.js";
import {
  PAUSE_TRANSITION_DURATION_MS,
  PAUSE_TRANSITION_EASING,
  Z_INDEX_OVERLAY,
} from "../../constants.js";
import { IconPause } from "../icons/icon-pause.jsx";

interface PauseChipProps {
  isVisible: boolean;
  snapEdge: SnapEdge;
  anchor: PauseChipAnchor;
  keyLabel: string;
}

export const PauseChip: Component<PauseChipProps> = (props) => {
  const placement = () => getPauseChipPlacement(props.snapEdge, props.anchor);
  const timing = `${PAUSE_TRANSITION_DURATION_MS}ms ${PAUSE_TRANSITION_EASING}`;

  return (
    <div
      data-react-grab-ignore-events
      data-react-grab-pause-chip
      data-visible={props.isVisible ? "" : undefined}
      aria-hidden="true"
      class="fixed flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full font-sans text-[10px] font-medium leading-4 antialiased select-none pointer-events-none bg-[var(--rg-panel-bg)] text-[var(--rg-text-primary)] [box-shadow:var(--rg-shadow)]"
      style={{
        left: `${placement().left}px`,
        top: `${placement().top}px`,
        translate: placement().translate,
        transform: props.isVisible ? "none" : placement().hiddenTransform,
        opacity: props.isVisible ? 1 : 0,
        transition: `opacity ${timing}, transform ${timing}`,
        "z-index": String(Z_INDEX_OVERLAY),
      }}
    >
      <IconPause size={8} class="text-[var(--rg-text-secondary)]" />
      <span>Paused</span>
      <kbd class="inline-flex shrink-0 items-center font-sans text-[10px] leading-none text-[var(--rg-text-secondary)]">
        {props.keyLabel}
      </kbd>
    </div>
  );
};
