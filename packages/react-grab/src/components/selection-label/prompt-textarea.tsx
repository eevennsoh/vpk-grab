import type { Component } from "solid-js";
import type { PromptTextareaProps } from "../../types.js";
import { TEXTAREA_MAX_HEIGHT_PX } from "../../constants.js";
import { autoResizeTextarea } from "../../utils/auto-resize-textarea.js";
import { cn } from "../../utils/cn.js";
import { focusInOverlay } from "../../utils/focus-in-overlay.js";

export const PromptTextarea: Component<PromptTextareaProps> = (props) => {
  const handleInput = (event: InputEvent) => {
    const inputTarget = event.target;
    if (!(inputTarget instanceof HTMLTextAreaElement)) return;
    autoResizeTextarea(inputTarget, TEXTAREA_MAX_HEIGHT_PX);
    props.onValueChange?.(inputTarget.value);
  };

  return (
    <textarea
      ref={(element) => {
        props.ref?.(element);
        // This ref fires during Solid's render commit when the surrounding
        // DOM tree isn't fully built yet, so focusing synchronously can fail
        // or cause a scroll jump.
        queueMicrotask(() => {
          if (props.shouldFocusOnMount) focusInOverlay(element, { preventScroll: true });
          autoResizeTextarea(element, TEXTAREA_MAX_HEIGHT_PX);
        });
      }}
      data-react-grab-ignore-events
      data-react-grab-input
      aria-label="Optional context"
      aria-keyshortcuts="Enter Escape"
      class={cn(
        "text-[var(--rg-text-primary)] text-[13px] leading-4 font-medium bg-transparent border-none resize-none p-0 m-0 wrap-break-word overflow-y-auto",
        props.class,
      )}
      style={{
        "field-sizing": "content",
        "min-height": "16px",
        "max-height": `${TEXTAREA_MAX_HEIGHT_PX}px`,
        "scrollbar-width": "none",
      }}
      value={props.value}
      onInput={handleInput}
      on:keydown={(event) => props.onKeyDown(event)}
      placeholder={props.placeholder ?? "Add context"}
      rows={1}
      readOnly={props.readOnly}
      onFocus={() => props.onFocus?.()}
      onBlur={() => props.onBlur?.()}
    />
  );
};
