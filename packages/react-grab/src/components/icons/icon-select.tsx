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

  return (
    <span
      class={cn("inline-flex items-center justify-center will-change-transform", props.class)}
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
