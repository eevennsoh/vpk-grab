import type { Component } from "solid-js";
import { DELETE_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconClearProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconClear: Component<IconClearProps> = (props) => (
  <MaterialIcon
    paths={DELETE_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
