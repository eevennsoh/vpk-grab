import type { Component } from "solid-js";
import { MOVE_ICON_PATH } from "../../constants.js";

interface IconMoveProps {
  size?: number;
  class?: string;
}

export const IconMove: Component<IconMoveProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <path d={MOVE_ICON_PATH} />
    </svg>
  );
};
