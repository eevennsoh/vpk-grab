import { isMac } from "./is-mac.js";

const UNDO_KEY = "z";
const REDO_KEY_OFF_MAC = "y";

// Cmd+Z / Cmd+Shift+Z on a Mac; Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y elsewhere.
export const getEditHistoryDirection = (event: KeyboardEvent): "undo" | "redo" | null => {
  const hasPlatformModifier = isMac() ? event.metaKey : event.ctrlKey;
  if (!hasPlatformModifier || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === UNDO_KEY) return event.shiftKey ? "redo" : "undo";
  if (!isMac() && key === REDO_KEY_OFF_MAC && !event.shiftKey) return "redo";
  return null;
};
