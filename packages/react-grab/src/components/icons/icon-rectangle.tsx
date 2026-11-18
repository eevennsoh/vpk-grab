import type { Component } from "solid-js";
import { CROP_7_5_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconRectangleProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconRectangle: Component<IconRectangleProps> = (props) => (
  <MaterialIcon
    paths={CROP_7_5_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
