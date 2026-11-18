import { isKeyOwnedByPillPrompt } from "./is-key-owned-by-pill-prompt.js";
import { isKeyboardEventTriggeredByInput } from "./is-keyboard-event-triggered-by-input.js";
import { isPillPromptEvent } from "./is-pill-prompt-event.js";

export const isTextFieldKeyEvent = (event: KeyboardEvent): boolean =>
  isPillPromptEvent(event) ? isKeyOwnedByPillPrompt(event) : isKeyboardEventTriggeredByInput(event);
