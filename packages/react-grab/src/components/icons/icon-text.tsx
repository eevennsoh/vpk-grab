import type { Component } from "solid-js";

interface IconTextProps {
  size?: number;
  class?: string;
}

export const IconText: Component<IconTextProps> = (props) => {
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
      <path d="M5 7V5h14v2M12 5v14M9 19h6" />
    </svg>
  );
};
