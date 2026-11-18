import type { Component } from "solid-js";
import { LINK_ICON_PATHS } from "../../material-icon-paths.js";
import { MaterialIcon } from "./material-icon.js";

interface IconLinkProps {
  size?: number;
}

export const IconLink: Component<IconLinkProps> = (props) => (
  <MaterialIcon paths={LINK_ICON_PATHS} size={props.size} />
);
