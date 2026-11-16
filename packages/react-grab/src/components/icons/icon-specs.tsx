import type { Component } from "solid-js";
import { PALETTE_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconSpecsProps {
  size?: number;
  class?: string;
  isFilled?: boolean;
}

export const IconSpecs: Component<IconSpecsProps> = (props) => (
  <MaterialIcon
    paths={PALETTE_ICON_PATHS}
    isFilled={props.isFilled}
    size={props.size}
    class={props.class}
  />
);
