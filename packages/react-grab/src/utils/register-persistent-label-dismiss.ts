import { ignoreRealInput } from "./runtime-mode.js";
import { isEventFromOverlay } from "./is-event-from-overlay.js";

interface RegisterPersistentLabelDismissOptions {
  onDismiss: () => void;
  hasDetachedAnchor: () => boolean;
}

// Passive on purpose: the press that dismisses the labels must still reach the
// page or overlay exactly as if no label had been on screen.
export const registerPersistentLabelDismiss = (
  options: RegisterPersistentLabelDismissOptions,
): (() => void) => {
  const handlePointerDown = ignoreRealInput((event: PointerEvent) => {
    if (isEventFromOverlay(event, "data-react-grab-completion")) return;
    options.onDismiss();
  });

  const handleKeyDown = ignoreRealInput((event: KeyboardEvent) => {
    if (event.code !== "Escape" || event.isComposing) return;
    options.onDismiss();
  });

  const anchorObserver = new MutationObserver(() => {
    if (options.hasDetachedAnchor()) options.onDismiss();
  });

  window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
  window.addEventListener("keydown", handleKeyDown, { capture: true });
  anchorObserver.observe(document, { childList: true, subtree: true });

  return () => {
    window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
    anchorObserver.disconnect();
  };
};
