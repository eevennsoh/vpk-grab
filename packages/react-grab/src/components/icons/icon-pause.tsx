import type { Component } from "solid-js";

interface IconPauseProps {
  size?: number;
  class?: string;
}

export const IconPause: Component<IconPauseProps> = (props) => {
  const size = () => props.size ?? 10;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
    >
      <rect x="6" y="4" width="4" height="16" rx="1.5" />
      <rect x="14" y="4" width="4" height="16" rx="1.5" />
    </svg>
  );
};
