import type { Component } from "solid-js";
import { TITLE_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconTextProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconText: Component<IconTextProps> = (props) => (
  <MaterialIcon
    paths={TITLE_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
