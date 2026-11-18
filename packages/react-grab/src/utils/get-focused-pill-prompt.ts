import { PILL_PROMPT_ATTRIBUTE } from "../constants.js";

export const getFocusedPillPrompt = (): HTMLTextAreaElement | null => {
  const focusedOverlayElement = document.activeElement?.shadowRoot?.activeElement;
  return focusedOverlayElement instanceof HTMLTextAreaElement &&
    focusedOverlayElement.closest(`[${PILL_PROMPT_ATTRIBUTE}]`)
    ? focusedOverlayElement
    : null;
};
