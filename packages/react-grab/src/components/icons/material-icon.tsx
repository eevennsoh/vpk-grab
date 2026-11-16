import type { Component } from "solid-js";
import { MATERIAL_ICON_VIEW_BOX } from "../../material-icon-paths.js";
import type { MaterialIconPaths } from "../../types.js";

interface MaterialIconProps {
  paths: MaterialIconPaths;
  isFilled?: boolean;
  size?: number;
  class?: string;
}

export const MaterialIcon: Component<MaterialIconProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox={MATERIAL_ICON_VIEW_BOX}
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
    >
      <path d={props.isFilled ? props.paths.filled : props.paths.outline} />
    </svg>
  );
};
