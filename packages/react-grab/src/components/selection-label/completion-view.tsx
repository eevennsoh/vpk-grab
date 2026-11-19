import { createSignal, onCleanup, Show, splitProps, type Component, type JSX } from "solid-js";
import type { CompletionViewProps, PillPromptProps } from "../../types.js";
import {
  COMPLETION_DISMISS_ICON_SIZE_PX,
  COMPLETION_DISMISS_TOOLTIP_SHORTCUT,
  COMPLETION_MAX_WIDTH_PX,
  COMPLETION_STATUS_ROW_HEIGHT_PX,
  COMPLETION_WITH_THUMBNAIL_MAX_WIDTH_PX,
  FEEDBACK_DURATION_MS,
  FADE_DURATION_MS,
  SCREENSHOT_THUMBNAIL_SIZE_PX,
  TEXTAREA_MAX_HEIGHT_PX,
} from "../../constants.js";
import { autoResizeTextarea } from "../../utils/auto-resize-textarea.js";
import { createConfirmationKeyboard } from "../../utils/create-confirmation-keyboard.js";
import { isEnterCode } from "../../utils/is-enter-code.js";
import { isEventFromOverlay } from "../../utils/is-event-from-overlay.js";
import { isKeyboardEventComposing } from "../../utils/is-keyboard-event-composing.js";
import { IconReturn } from "../icons/icon-return.jsx";
import { cn } from "../../utils/cn.js";
import { Button, buttonVariants } from "../ui/button.js";
import { Surface } from "../ui/surface.js";
import { IconCheck } from "../icons/icon-check.jsx";
import { IconLoader } from "../icons/icon-loader.jsx";
import { MaterialIcon } from "../icons/material-icon.jsx";
import { CLOSE_SMALL_ICON_PATHS, PHOTO_CAMERA_ICON_PATHS } from "../../material-icon-paths.js";
import { Tooltip } from "../tooltip.jsx";
import { PromptTextarea } from "./prompt-textarea.js";

interface CompletionTooltipAnchor {
  label: string;
  shortcut?: string;
  button: HTMLButtonElement;
}

interface CompletionTooltipContent {
  label: string;
  shortcut?: string;
  rightOffsetPx: number;
}

interface CompletionActionButtonProps {
  label: string;
  tooltipShortcut?: string;
  onClick: (event: MouseEvent) => void;
  onTooltipChange: (anchor: CompletionTooltipAnchor | null) => void;
  children: JSX.Element;
}

const CompletionActionButton: Component<CompletionActionButtonProps> = (props) => {
  const [local, attributes] = splitProps(props, [
    "label",
    "tooltipShortcut",
    "onClick",
    "onTooltipChange",
    "children",
  ]);
  let isPressed = false;
  const showTooltip = (button: HTMLButtonElement) =>
    local.onTooltipChange({ label: local.label, shortcut: local.tooltipShortcut, button });
  const hideTooltip = () => local.onTooltipChange(null);
  return (
    <button
      type="button"
      data-react-grab-ignore-events
      data-react-grab-completion-action
      aria-label={local.label}
      class={cn(
        buttonVariants({ variant: "ghost" }),
        "group pointer-events-auto size-4 text-[var(--rg-text-secondary)] hover:text-[var(--rg-text-primary)]",
      )}
      // The on: prefix attaches a native event listener (rather than using
      // SolidJS delegation) so stopImmediatePropagation can beat both
      // delegated handlers and document-level capture listeners.
      on:pointerdown={(event) => {
        event.stopImmediatePropagation();
        isPressed = true;
        hideTooltip();
      }}
      on:click={(event) => {
        event.stopImmediatePropagation();
        hideTooltip();
        local.onClick(event);
      }}
      on:pointerenter={(event) => {
        if (event.pointerType === "touch" || isPressed) return;
        showTooltip(event.currentTarget);
      }}
      on:pointerleave={() => {
        isPressed = false;
        hideTooltip();
      }}
      on:focus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) showTooltip(event.currentTarget);
      }}
      on:blur={hideTooltip}
      {...attributes}
    >
      {local.children}
    </button>
  );
};

const ACTION_ICON_CLASS = "opacity-50 group-hover:opacity-100 transition-opacity";

const PillPrompt: Component<PillPromptProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  let hasFocus = false;
  const [promptText, setPromptText] = createSignal("");

  const releaseFocus = () => {
    if (!hasFocus) return;
    hasFocus = false;
    textareaRef?.blur();
    props.onFocusRelease?.();
  };

  onCleanup(releaseFocus);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isKeyboardEventComposing(event)) return;
    event.stopImmediatePropagation();
    if (isEnterCode(event.code) && !event.shiftKey) {
      event.preventDefault();
      const prompt = promptText().trim();
      if (prompt) props.onSubmit(prompt);
      return;
    }
    if (event.code === "Escape" && promptText()) {
      event.preventDefault();
      setPromptText("");
      if (textareaRef) autoResizeTextarea(textareaRef, TEXTAREA_MAX_HEIGHT_PX);
      if (props.isGrabActive) releaseFocus();
    }
  };

  return (
    <div data-react-grab-pill-prompt class="flex items-center min-w-0 ml-1.5 py-1.5">
      <PromptTextarea
        ref={(element) => (textareaRef = element)}
        placeholder="Optional context"
        class="min-w-0"
        value={promptText()}
        shouldFocusOnMount={props.shouldFocus}
        onValueChange={setPromptText}
        onKeyDown={handleKeyDown}
        onFocus={() => (hasFocus = true)}
        onBlur={() => (hasFocus = false)}
      />
    </div>
  );
};

export const CompletionView: Component<CompletionViewProps> = (props) => {
  let surfaceRef: HTMLDivElement | undefined;
  let fadeTimeoutId: number | undefined;
  let dismissTimeoutId: number | undefined;
  const [didCopy, setDidCopy] = createSignal(false);
  const [tooltipContent, setTooltipContent] = createSignal<CompletionTooltipContent | null>(null);
  const [isFading, setIsFading] = createSignal(false);
  const displayStatusText = () => (didCopy() ? "Copied" : props.statusText);
  const maxWidth = () => {
    if (!props.onSubmitPrompt) return COMPLETION_MAX_WIDTH_PX;
    return Math.min(
      props.availableWidth,
      props.thumbnailUrl ? COMPLETION_WITH_THUMBNAIL_MAX_WIDTH_PX : COMPLETION_MAX_WIDTH_PX,
    );
  };

  // The tooltip sits outside the pill's edge rather than beside its button, so
  // it never covers the status text, a wrapped field or the error row; only its
  // right edge follows the button, which stays at the end of the row.
  const handleTooltipChange = (anchor: CompletionTooltipAnchor | null) => {
    if (!anchor || !surfaceRef) {
      setTooltipContent(null);
      return;
    }
    setTooltipContent({
      label: anchor.label,
      shortcut: anchor.shortcut,
      rightOffsetPx:
        surfaceRef.getBoundingClientRect().right - anchor.button.getBoundingClientRect().right,
    });
  };

  const handleAccept = () => {
    if (didCopy()) return;
    setDidCopy(true);
    fadeTimeoutId = window.setTimeout(() => {
      setIsFading(true);
      props.onFadingChange?.(true);
      dismissTimeoutId = window.setTimeout(() => {
        props.onDismiss?.();
      }, FADE_DURATION_MS);
    }, FEEDBACK_DURATION_MS - FADE_DURATION_MS);
  };

  // Without onDismiss the label only offers its action buttons, so Enter and
  // Escape elsewhere are left to the page while the label stays on screen.
  // Only one label owns this listener, so Enter on an action button is left to
  // the button itself: handling it here would act on the owning label instead.
  const { claimFocus } = createConfirmationKeyboard({
    onEnter: (event) => {
      if (isEventFromOverlay(event, "data-react-grab-completion-action")) return;
      if (!props.onDismiss) return;
      event.preventDefault();
      event.stopPropagation();
      handleAccept();
    },
    onEscape: (event) => {
      if (!props.onDismiss) return;
      event.preventDefault();
      event.stopPropagation();
      props.onDismiss();
    },
  });

  onCleanup(() => {
    if (fadeTimeoutId !== undefined) window.clearTimeout(fadeTimeoutId);
    if (dismissTimeoutId !== undefined) window.clearTimeout(dismissTimeoutId);
  });

  return (
    <>
      <Surface
        ref={(element) => (surfaceRef = element)}
        shape="pill"
        data-react-grab-completion
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="shrink-0 flex flex-col justify-center items-end w-fit h-fit max-w-(--completion-max-width) has-placeholder-shown:max-w-(--available-width) transition-opacity duration-100 ease-out"
        style={{
          opacity: isFading() ? 0 : 1,
          "--completion-max-width": `${maxWidth()}px`,
          "--available-width": `${props.availableWidth}px`,
          width: props.onSubmitPrompt ? "max-content" : undefined,
        }}
        onPointerDown={claimFocus}
        onClick={claimFocus}
      >
        <Show when={!didCopy() && props.onDismiss}>
          <div class="contain-layout shrink-0 flex items-center justify-between gap-2 pt-1.5 pb-1 px-2 w-full h-fit">
            <span
              class="text-[var(--rg-text-primary)] text-[13px] leading-4 font-sans font-medium h-fit tabular-nums overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              textContent={displayStatusText()}
            />
            <div class="contain-layout shrink-0 flex items-center gap-2 h-fit">
              <Show when={props.onDismiss}>
                <Button
                  data-react-grab-dismiss
                  class="gap-1"
                  aria-keyshortcuts="Enter"
                  onClick={handleAccept}
                  disabled={didCopy()}
                  aria-disabled={didCopy()}
                >
                  <span class="text-[var(--rg-text-primary)] text-[13px] leading-3.5 font-sans font-medium">
                    Keep
                  </span>
                  <Show when={!didCopy()}>
                    <IconReturn size={10} class="text-[var(--rg-text-secondary)]" />
                  </Show>
                </Button>
              </Show>
            </div>
          </div>
        </Show>
        <Show when={didCopy() || !props.onDismiss}>
          <div
            class="contain-layout shrink-0 flex items-center gap-0.5 px-2 w-full h-fit"
            style={{ "min-height": `${COMPLETION_STATUS_ROW_HEIGHT_PX}px` }}
          >
            <Show
              when={props.thumbnailUrl}
              fallback={
                <IconCheck
                  size={14}
                  aria-hidden="true"
                  class="text-[var(--rg-text-primary-85)] shrink-0"
                />
              }
            >
              {(thumbnailUrl) => (
                <img
                  data-react-grab-screenshot-thumbnail
                  src={thumbnailUrl()}
                  alt=""
                  class="shrink-0 mr-1 rounded-[3px] object-cover border border-[var(--rg-border-subtle)]"
                  style={{
                    width: `${SCREENSHOT_THUMBNAIL_SIZE_PX}px`,
                    height: `${SCREENSHOT_THUMBNAIL_SIZE_PX}px`,
                  }}
                />
              )}
            </Show>
            <span
              class="text-[var(--rg-text-primary)] text-[13px] leading-4 font-sans font-medium h-fit tabular-nums overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              classList={{ "shrink-0": Boolean(props.onSubmitPrompt) }}
              textContent={displayStatusText()}
            />
            <Show when={props.onSubmitPrompt}>
              {(onSubmitPrompt) => (
                <PillPrompt
                  shouldFocus={props.shouldFocusPrompt}
                  isGrabActive={props.isGrabActive}
                  onSubmit={onSubmitPrompt()}
                  onFocusRelease={props.onPromptFocusRelease}
                />
              )}
            </Show>
            <Show when={props.onCopyScreenshot || props.onDismissPill}>
              <span
                data-react-grab-completion-separator
                aria-hidden="true"
                class="shrink-0 mx-1 w-px h-3 bg-[var(--rg-border-subtle)]"
              />
            </Show>
            <Show when={props.onCopyScreenshot}>
              {(onCopyScreenshot) => (
                <Show
                  when={!props.isCapturingScreenshot}
                  fallback={
                    <span
                      data-react-grab-screenshot-capturing
                      role="img"
                      aria-label="Capturing image"
                      class="shrink-0 flex items-center justify-center size-4"
                    >
                      <IconLoader size={13} class="text-[var(--rg-text-secondary)]" />
                    </span>
                  }
                >
                  <CompletionActionButton
                    data-react-grab-copy-screenshot
                    label="Copy image"
                    onClick={onCopyScreenshot()}
                    onTooltipChange={handleTooltipChange}
                  >
                    <MaterialIcon
                      paths={PHOTO_CAMERA_ICON_PATHS}
                      size={14}
                      class={ACTION_ICON_CLASS}
                    />
                  </CompletionActionButton>
                </Show>
              )}
            </Show>
            <Show when={props.onDismissPill}>
              {(onDismissPill) => (
                <CompletionActionButton
                  label="Dismiss"
                  tooltipShortcut={COMPLETION_DISMISS_TOOLTIP_SHORTCUT}
                  aria-keyshortcuts="Escape"
                  onClick={onDismissPill()}
                  onTooltipChange={handleTooltipChange}
                >
                  <MaterialIcon
                    paths={CLOSE_SMALL_ICON_PATHS}
                    size={COMPLETION_DISMISS_ICON_SIZE_PX}
                    class={ACTION_ICON_CLASS}
                  />
                </CompletionActionButton>
              )}
            </Show>
          </div>
          <Show when={props.screenshotError}>
            {(screenshotError) => (
              <div
                data-react-grab-screenshot-error
                role="alert"
                class="contain-layout shrink-0 flex items-start px-2 pb-1.5 w-full h-fit"
              >
                <span
                  class="text-[var(--rg-error-text)] text-[13px] leading-4 font-sans font-medium overflow-hidden line-clamp-5"
                  textContent={screenshotError()}
                />
              </div>
            )}
          </Show>
        </Show>
      </Surface>
      <Tooltip
        visible={Boolean(tooltipContent()) && !props.isDismissing && !isFading()}
        position={props.tooltipPosition}
        anchorRightPx={tooltipContent()?.rightOffsetPx}
        textContent={tooltipContent()?.label ?? ""}
        shortcut={tooltipContent()?.shortcut}
      />
    </>
  );
};
