import { getFocusedPillPrompt } from "./get-focused-pill-prompt.js";

export const blurFocusedPillPrompt = (): void => {
  getFocusedPillPrompt()?.blur();
};
