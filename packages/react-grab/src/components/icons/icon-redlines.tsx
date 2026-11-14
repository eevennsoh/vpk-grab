import type { Component } from "solid-js";

interface IconRedlinesProps {
  size?: number;
  class?: string;
}

export const IconRedlines: Component<IconRedlinesProps> = (props) => {
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
      <path d="M3 6v12M21 6v12M3 12h18M7 9l-3 3 3 3M17 9l3 3-3 3" />
    </svg>
  );
};
