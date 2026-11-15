import type { Component } from "solid-js";
import { STYLUS_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconPenProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconPen: Component<IconPenProps> = (props) => (
  <MaterialIcon
    paths={STYLUS_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
