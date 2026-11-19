import { CLEAR_ANNOTATIONS_KEYS } from "../constants.js";
import { isMac } from "./is-mac.js";

interface ClearAnnotationsKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

// Cmd+Backspace on a Mac; Ctrl+Backspace elsewhere. Delete works too.
export const isClearAnnotationsShortcut = (event: ClearAnnotationsKeyEvent): boolean => {
  if (!CLEAR_ANNOTATIONS_KEYS.has(event.key)) return false;
  if (event.shiftKey || event.altKey) return false;
  return isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
};
