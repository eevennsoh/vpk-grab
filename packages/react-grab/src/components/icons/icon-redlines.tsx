import type { Component } from "solid-js";
import { STRAIGHTEN_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconRedlinesProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconRedlines: Component<IconRedlinesProps> = (props) => (
  <MaterialIcon
    paths={STRAIGHTEN_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
