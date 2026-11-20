import { isEnterCode } from "./is-enter-code.js";
import { isMac } from "./is-mac.js";

interface PillSwapCopyKeyEvent {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

// Cmd+Enter on a Mac; Ctrl+Enter elsewhere.
export const isPillSwapCopyShortcut = (event: PillSwapCopyKeyEvent): boolean => {
  if (!isEnterCode(event.code) || event.shiftKey || event.altKey) return false;
  return isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
};
