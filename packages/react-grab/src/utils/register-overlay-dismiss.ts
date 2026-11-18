import type { OverlayDismissSource } from "../types.js";
import { ignoreRealInput, IS_DEMO } from "./runtime-mode.js";
import { isEventFromOverlay } from "./is-event-from-overlay.js";
import { isKeyboardEventTriggeredByInput } from "./is-keyboard-event-triggered-by-input.js";
import { nativeCancelAnimationFrame, nativeRequestAnimationFrame } from "./native-raf.js";
import { overlayDismiss } from "./overlay-dismiss.js";
import { isKeyboardEventComposing } from "./is-keyboard-event-composing.js";

interface RegisterOverlayDismissOptions {
  isOpen: () => boolean;
  onDismiss: (source: OverlayDismissSource) => void;
  shouldIgnoreKeyboardEvent?: (event: KeyboardEvent) => boolean;
  shouldIgnorePointerEvent?: (event: MouseEvent | TouchEvent) => boolean;
  shouldIgnoreInputEvents?: boolean;
}

export const registerOverlayDismiss = (options: RegisterOverlayDismissOptions): (() => void) => {
  const dismissOnEscape = (event: KeyboardEvent): boolean => {
    if (IS_DEMO && event.isTrusted) return false;
    if (!options.isOpen() || isKeyboardEventComposing(event)) return false;
    if (options.shouldIgnoreKeyboardEvent?.(event)) return false;
    if (options.shouldIgnoreInputEvents && isKeyboardEventTriggeredByInput(event)) {
      return false;
    }

    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onDismiss("keyboard");
      return true;
    }
    return false;
  };
  const unregisterDismiss = overlayDismiss.register({
    isOpen: options.isOpen,
    onEscape: dismissOnEscape,
  });

  const handleClickOutside = ignoreRealInput((event: MouseEvent | TouchEvent) => {
    if (!options.isOpen()) return;
    if (
      options.shouldIgnorePointerEvent
        ? options.shouldIgnorePointerEvent(event)
        : isEventFromOverlay(event, "data-react-grab-ignore-events")
    )
      return;
    options.onDismiss("pointer");
  });

  // Click registration is deferred to the next frame so the same click or
  // touch that opened the overlay does not immediately trigger a dismiss.
  const frameId = nativeRequestAnimationFrame(() => {
    window.addEventListener("mousedown", handleClickOutside, {
      capture: true,
    });
    window.addEventListener("touchstart", handleClickOutside, {
      capture: true,
    });
  });

  return () => {
    unregisterDismiss();
    nativeCancelAnimationFrame(frameId);
    window.removeEventListener("mousedown", handleClickOutside, {
      capture: true,
    });
    window.removeEventListener("touchstart", handleClickOutside, {
      capture: true,
    });
  };
};
