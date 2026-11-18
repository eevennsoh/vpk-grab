import { onCleanup } from "solid-js";
import type { Position } from "../types.js";
import { ignoreRealInput } from "./runtime-mode.js";

export const createPointerPositionTracker = (): (() => Position | null) => {
  const position: Position = { x: 0, y: 0 };
  let isPointerInWindow = false;

  const updatePosition = ignoreRealInput((event: PointerEvent) => {
    if (!event.isPrimary) return;
    position.x = event.clientX;
    position.y = event.clientY;
    isPointerInWindow = true;
  });
  const handlePointerOut = ignoreRealInput((event: PointerEvent) => {
    if (event.isPrimary && event.relatedTarget === null) isPointerInWindow = false;
  });

  window.addEventListener("pointermove", updatePosition, { capture: true });
  window.addEventListener("pointerdown", updatePosition, { capture: true });
  window.addEventListener("pointerout", handlePointerOut, { capture: true });
  onCleanup(() => {
    window.removeEventListener("pointermove", updatePosition, { capture: true });
    window.removeEventListener("pointerdown", updatePosition, { capture: true });
    window.removeEventListener("pointerout", handlePointerOut, { capture: true });
  });

  return () => (isPointerInWindow ? position : null);
};
