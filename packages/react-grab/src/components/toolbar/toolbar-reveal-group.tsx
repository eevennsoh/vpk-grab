import type { Component, JSX } from "solid-js";
import { cn } from "../../utils/cn.js";

interface ToolbarRevealGroupProps {
  ref: (element: HTMLDivElement) => void;
  dataAttribute: string;
  isRevealed: boolean;
  isVertical: boolean;
  children: JSX.Element;
}

// A run of toolbar buttons that joins the toolbar only while it has something
// to act on. The group opens the same way the toolbar itself expands: its
// track grows while the buttons fade in behind it.
export const ToolbarRevealGroup: Component<ToolbarRevealGroupProps> = (props) => {
  const trackClass = () => {
    if (props.isVertical) {
      return props.isRevealed
        ? "grid-rows-[1fr] transition-[grid-template-rows] duration-220"
        : "grid-rows-[0fr] transition-[grid-template-rows] duration-140";
    }
    return props.isRevealed
      ? "grid-cols-[1fr] transition-[grid-template-columns] duration-220"
      : "grid-cols-[0fr] transition-[grid-template-columns] duration-140";
  };

  return (
    <div
      ref={props.ref}
      {...{ [props.dataAttribute]: "" }}
      data-revealed={props.isRevealed ? "" : undefined}
      inert={!props.isRevealed}
      class={cn("grid ease-drawer", trackClass(), !props.isRevealed && "pointer-events-none")}
    >
      <div
        class={cn(
          "flex items-center ease-drawer transition-opacity",
          props.isVertical ? "flex-col min-h-0" : "min-w-0",
          props.isRevealed ? "opacity-100 duration-180 delay-[80ms]" : "opacity-0 duration-100",
        )}
      >
        {props.children}
      </div>
    </div>
  );
};
