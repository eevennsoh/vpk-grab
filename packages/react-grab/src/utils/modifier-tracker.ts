import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import { ignoreRealInput } from "./runtime-mode.js";

// Tracks whether a keyboard modifier is currently held. Window blur resets it
// because a chord / alt-tab usually swallows the keyup event and leaves the
// flag stuck. A system shortcut such as Cmd+Shift+4 can swallow the keyup
// without a blur, so a pointer event that reports the modifier up clears it
// too; pointer events never set it, so a modifier typed into a field stays
// ignored. Events `shouldIgnoreEvent` picks out leave the flag as it was.
export const createModifierTracker = (
  readModifier: (event: KeyboardEvent | PointerEvent) => boolean,
  shouldIgnoreEvent?: (event: KeyboardEvent) => boolean,
): Accessor<boolean> => {
  const [isHeld, setIsHeld] = createSignal(false);

  onMount(() => {
    const updateFromEvent = ignoreRealInput((event: KeyboardEvent) => {
      if (shouldIgnoreEvent?.(event)) return;
      setIsHeld(readModifier(event));
    });
    const clearFromPointer = ignoreRealInput((event: PointerEvent) => {
      if (!readModifier(event)) setIsHeld(false);
    });
    const clear = () => setIsHeld(false);
    window.addEventListener("keydown", updateFromEvent, { capture: true });
    window.addEventListener("keyup", updateFromEvent, { capture: true });
    window.addEventListener("pointerdown", clearFromPointer, { capture: true });
    window.addEventListener("pointermove", clearFromPointer, { capture: true });
    window.addEventListener("blur", clear);
    onCleanup(() => {
      window.removeEventListener("keydown", updateFromEvent, { capture: true });
      window.removeEventListener("keyup", updateFromEvent, { capture: true });
      window.removeEventListener("pointerdown", clearFromPointer, { capture: true });
      window.removeEventListener("pointermove", clearFromPointer, { capture: true });
      window.removeEventListener("blur", clear);
    });
  });

  return isHeld;
};
