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
      <path d="M2.7 15.3a2.4 2.4 0 0 0 0 3.4l2.6 2.6a2.4 2.4 0 0 0 3.4 0L21.3 8.7a2.41 2.41 0 0 0 0-3.4l-2.6-2.6a2.41 2.41 0 0 0-3.4 0Z" />
      <path d="M9.5 12.5l-2-2M12.5 9.5l-2-2M15.5 6.5l-2-2M6.5 15.5l-2-2" />
    </svg>
  );
};
