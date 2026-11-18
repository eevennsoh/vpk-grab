import { createSignal, onCleanup, Show, splitProps, type Component, type JSX } from "solid-js";
import type { CompletionViewProps, PillPromptProps } from "../../types.js";
import {
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
import { PHOTO_CAMERA_ICON_PATHS } from "../../material-icon-paths.js";
import { PromptTextarea } from "./prompt-textarea.js";

interface CompletionActionButtonProps {
  label: string;
  onClick: () => void;
  children: JSX.Element;
}

const CompletionActionButton: Component<CompletionActionButtonProps> = (props) => {
  const [local, attributes] = splitProps(props, ["label", "onClick", "children"]);
  return (
    <button
      type="button"
      data-react-grab-ignore-events
      data-react-grab-completion-action
      aria-label={local.label}
      class={cn(
        buttonVariants({ variant: "ghost" }),
        "group size-4 text-[var(--rg-text-secondary)] hover:text-[var(--rg-text-primary)]",
      )}
      // The on: prefix attaches a native event listener (rather than using
      // SolidJS delegation) so stopImmediatePropagation can beat both
      // delegated handlers and document-level capture listeners.
      on:pointerdown={(event) => {
        event.stopImmediatePropagation();
      }}
      on:click={(event) => {
        event.stopImmediatePropagation();
        local.onClick();
      }}
      {...attributes}
    >
      {local.children}
    </button>
  );
};

const ACTION_ICON_CLASS = "opacity-50 group-hover:opacity-100 transition-opacity";

// An empty prompt leaves every key but text to the page (the overlay's keydown
// handler sees to that), so Escape only has work here once there is text.
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
      releaseFocus();
    }
  };

  return (
    <div data-react-grab-pill-prompt class="flex items-center min-w-0 ml-1.5">
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
  let fadeTimeoutId: number | undefined;
  let dismissTimeoutId: number | undefined;
  const [didCopy, setDidCopy] = createSignal(false);
  const [isFading, setIsFading] = createSignal(false);
  const displayStatusText = () => (didCopy() ? "Copied" : props.statusText);

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
    <Surface
      shape="pill"
      data-react-grab-completion
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="shrink-0 flex flex-col justify-center items-end w-fit h-fit max-w-[280px] transition-opacity duration-100 ease-out"
      style={{ opacity: isFading() ? 0 : 1 }}
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
        <div class="contain-layout shrink-0 flex items-center gap-0.5 py-1.5 px-2 w-full h-fit">
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
                onSubmit={onSubmitPrompt()}
                onFocusRelease={props.onPromptFocusRelease}
              />
            )}
          </Show>
          <Show when={props.onCopyScreenshot}>
            {(onCopyScreenshot) => (
              <>
                <span
                  aria-hidden="true"
                  class="shrink-0 mx-1 w-px h-3 bg-[var(--rg-border-subtle)]"
                />
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
                    label="Copy with screenshot"
                    onClick={onCopyScreenshot()}
                  >
                    <MaterialIcon
                      paths={PHOTO_CAMERA_ICON_PATHS}
                      size={14}
                      class={ACTION_ICON_CLASS}
                    />
                  </CompletionActionButton>
                </Show>
              </>
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
  );
};
