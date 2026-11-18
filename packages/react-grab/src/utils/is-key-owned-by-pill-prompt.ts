import { isEnterCode } from "./is-enter-code.js";
import { isKeyboardEventComposing } from "./is-keyboard-event-composing.js";
import { isPillPromptEvent } from "./is-pill-prompt-event.js";

// The pill's prompt takes focus right after a copy, so while it is empty only
// text and Enter are its own and every other key acts as it would on the
// page. Once it holds text, every key belongs to it.
export const isKeyOwnedByPillPrompt = (event: KeyboardEvent): boolean => {
  if (!isPillPromptEvent(event)) return false;
  if (isKeyboardEventComposing(event) || isEnterCode(event.code)) return true;
  const isCharacterKey = event.key.length === 1 && !event.metaKey && !event.ctrlKey;
  if (isCharacterKey) return true;
  const promptTextarea = event.composedPath()[0];
  return promptTextarea instanceof HTMLTextAreaElement && promptTextarea.value.length > 0;
};
