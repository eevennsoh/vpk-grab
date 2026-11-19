import { createUniqueId, Show, type Component, type JSX } from "solid-js";
import { Tooltip } from "../tooltip.jsx";

interface ToolbarActionButtonProps {
  actionId: string;
  label: string;
  isActive?: boolean;
  isToggle?: boolean;
  hasPressedState?: boolean;
  keepsPageFocus?: boolean;
  class?: string;
  wrapperClass?: string;
  ref?: (element: HTMLButtonElement) => void;
  onClick?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  icon: JSX.Element;
  tooltip?: string;
  tooltipShortcut?: string;
  tooltipVisible?: boolean;
  tooltipPosition?: "top" | "bottom" | "left" | "right";
}

export const ToolbarActionButton: Component<ToolbarActionButtonProps> = (props) => {
  const tooltipId = createUniqueId();
  return (
    <div class={props.wrapperClass}>
      <button
        ref={props.ref}
        data-react-grab-ignore-events
        data-react-grab-toolbar-toggle={props.isToggle ? "" : undefined}
        data-react-grab-toolbar-action={props.actionId}
        aria-label={props.label}
        aria-describedby={props.tooltip && props.tooltipVisible ? tooltipId : undefined}
        aria-pressed={props.hasPressedState === false ? undefined : Boolean(props.isActive)}
        type="button"
        class={props.class}
        onClick={props.onClick}
        on:mousedown={(event) => {
          // A press that moved focus onto the toolbar would close whatever the
          // page shows only while focused, and would leave the activation
          // shortcut landing on this button instead of the page.
          if (props.keepsPageFocus) event.preventDefault();
        }}
        on:contextmenu={(event) => props.onContextMenu?.(event)}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        {props.icon}
      </button>
      <Show when={props.tooltip}>
        {(tooltip) => (
          <Tooltip
            id={tooltipId}
            visible={Boolean(props.tooltipVisible)}
            position={props.tooltipPosition ?? "top"}
            textContent={tooltip()}
            shortcut={props.tooltipShortcut}
          />
        )}
      </Show>
    </div>
  );
};
