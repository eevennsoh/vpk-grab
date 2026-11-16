import type { Component } from "solid-js";
import { PAN_TOOL_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconMoveProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconMove: Component<IconMoveProps> = (props) => (
  <MaterialIcon
    paths={PAN_TOOL_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
