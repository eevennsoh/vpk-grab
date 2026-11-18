import { PILL_PROMPT_ATTRIBUTE } from "../constants.js";

export const blurFocusedPillPrompt = (): void => {
  const focusedOverlayElement = document.activeElement?.shadowRoot?.activeElement;
  if (
    focusedOverlayElement instanceof HTMLElement &&
    focusedOverlayElement.closest(`[${PILL_PROMPT_ATTRIBUTE}]`)
  ) {
    focusedOverlayElement.blur();
  }
};
