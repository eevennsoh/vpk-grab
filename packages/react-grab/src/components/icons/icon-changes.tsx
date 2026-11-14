import type { Component } from "solid-js";

interface IconChangesProps {
  size?: number;
  class?: string;
}

export const IconChanges: Component<IconChangesProps> = (props) => {
  const size = () => props.size ?? 12;

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
      <path d="M4 6h10" />
      <path d="M4 12h16" />
      <path d="M4 18h7" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
};
