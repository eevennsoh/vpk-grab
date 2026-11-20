import { createEffect, createSignal, on, type Component } from "solid-js";
import type { PromptTextareaProps } from "../../types.js";
import { TEXTAREA_MAX_HEIGHT_PX } from "../../constants.js";
import { autoResizeTextarea } from "../../utils/auto-resize-textarea.js";
import { cn } from "../../utils/cn.js";
import { focusInOverlay } from "../../utils/focus-in-overlay.js";
import { getPromptEdgeFadeMask } from "../../utils/get-prompt-edge-fade-mask.js";

export const PromptTextarea: Component<PromptTextareaProps> = (props) => {
  const [hasHiddenStart, setHasHiddenStart] = createSignal(false);
  const [hasHiddenEnd, setHasHiddenEnd] = createSignal(false);

  // A single-line field scrolls sideways instead of wrapping; the edges fade
  // where text runs past them so the user can tell there is more.
  const updateEdgeFade = (textarea: HTMLTextAreaElement) => {
    if (!props.isSingleLine) return;
    setHasHiddenStart(textarea.scrollLeft > 0);
    setHasHiddenEnd(textarea.scrollLeft + textarea.clientWidth < textarea.scrollWidth - 1);
  };

  let textareaElement: HTMLTextAreaElement | undefined;
  // The value can also change from outside (Escape clears it), and the fade
  // has to be measured once the DOM holds the new text.
  createEffect(
    on(
      () => props.value,
      () => {
        if (textareaElement) updateEdgeFade(textareaElement);
      },
      { defer: true },
    ),
  );

  const handleInput = (event: InputEvent) => {
    const inputTarget = event.target;
    if (!(inputTarget instanceof HTMLTextAreaElement)) return;
    if (props.isSingleLine) {
      if (inputTarget.value.includes("\n"))
        inputTarget.value = inputTarget.value.replace(/\n/g, " ");
      updateEdgeFade(inputTarget);
    } else {
      autoResizeTextarea(inputTarget, TEXTAREA_MAX_HEIGHT_PX);
    }
    props.onValueChange?.(inputTarget.value);
  };

  const handleCaretMove = (event: Event) => {
    if (event.currentTarget instanceof HTMLTextAreaElement) updateEdgeFade(event.currentTarget);
  };

  return (
    <textarea
      ref={(element) => {
        textareaElement = element;
        props.ref?.(element);
        // This ref fires during Solid's render commit when the surrounding
        // DOM tree isn't fully built yet, so focusing synchronously can fail
        // or cause a scroll jump.
        queueMicrotask(() => {
          if (props.shouldFocusOnMount) focusInOverlay(element, { preventScroll: true });
          if (props.isSingleLine) updateEdgeFade(element);
          else autoResizeTextarea(element, TEXTAREA_MAX_HEIGHT_PX);
        });
      }}
      data-react-grab-ignore-events
      data-react-grab-input
      aria-label="Optional context"
      aria-keyshortcuts="Enter Escape"
      class={cn(
        "text-[var(--rg-text-primary)] text-[13px] leading-4 font-medium bg-transparent border-none resize-none p-0 m-0",
        props.isSingleLine
          ? "whitespace-pre overflow-x-auto overflow-y-hidden"
          : "wrap-break-word overflow-y-auto",
        props.class,
      )}
      style={{
        "field-sizing": "content",
        "min-height": "16px",
        "max-height": props.isSingleLine ? "16px" : `${TEXTAREA_MAX_HEIGHT_PX}px`,
        "scrollbar-width": "none",
        "mask-image": getPromptEdgeFadeMask(hasHiddenStart(), hasHiddenEnd()),
      }}
      value={props.value}
      onInput={handleInput}
      onScroll={handleCaretMove}
      onKeyUp={handleCaretMove}
      onClick={handleCaretMove}
      on:keydown={(event) => props.onKeyDown(event)}
      placeholder={props.placeholder ?? "Add context"}
      rows={1}
      wrap={props.isSingleLine ? "off" : undefined}
      readOnly={props.readOnly}
      onFocus={() => props.onFocus?.()}
      onBlur={() => props.onBlur?.()}
    />
  );
};
