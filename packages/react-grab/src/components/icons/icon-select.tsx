import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";
import { SELECT_ICON_ROTATION_TRANSITION_MS } from "../../constants.js";
import { NAVIGATION_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconSelectProps {
  size?: number;
  class?: string;
  rotationDeg?: number;
  isFilled?: boolean;
}

export const IconSelect: Component<IconSelectProps> = (props) => {
  const rotationDeg = () => props.rotationDeg ?? 0;

  // Pointer events pass through the rotating icon to the button: Chromium sends
  // the button a mouseleave when the pointer moves onto this transformed,
  // will-change layer, which dropped the button's hover (and its tooltip).
  return (
    <span
      class={cn(
        "inline-flex items-center justify-center will-change-transform pointer-events-none",
        props.class,
      )}
      style={{
        transform: `rotate(${rotationDeg()}deg)`,
        "transition-property": "transform",
        "transition-duration": `${SELECT_ICON_ROTATION_TRANSITION_MS}ms`,
        "transition-timing-function": "cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <MaterialIcon paths={NAVIGATION_ICON_PATHS} isFilled={props.isFilled} size={props.size} />
    </span>
  );
};
