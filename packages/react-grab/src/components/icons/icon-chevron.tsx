import type { Component } from "solid-js";
import { KEYBOARD_ARROW_DOWN_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconChevronProps {
  size?: number;
  class?: string;
}

// Points down; rotate it for the other directions.
export const IconChevron: Component<IconChevronProps> = (props) => (
  <MaterialIcon paths={KEYBOARD_ARROW_DOWN_ICON_PATHS} size={props.size} class={props.class} />
);
