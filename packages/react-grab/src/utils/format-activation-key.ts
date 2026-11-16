import type { ActivationKey } from "../types.js";
import { isMac } from "./is-mac.js";
import { getModifiersFromActivationKey } from "./parse-activation-key.js";

const DEFAULT_ACTIVATION_KEY = "c";

const formatKeyName = (key: string): string =>
  key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);

// The activation shortcut as a person reads it: Mac modifier symbols run
// together (⌘C), elsewhere names joined by "+" (Ctrl+C). A function shortcut
// has no fixed keys to show.
export const formatActivationKey = (
  activationKey: ActivationKey | undefined,
): string | undefined => {
  if (typeof activationKey === "function") return undefined;
  const modifiers = getModifiersFromActivationKey(activationKey);
  const key = activationKey ? modifiers.key : DEFAULT_ACTIVATION_KEY;
  const keyLabel = key ? formatKeyName(key) : "";

  if (isMac()) {
    const symbols = [
      modifiers.ctrlKey ? "⌃" : "",
      modifiers.altKey ? "⌥" : "",
      modifiers.shiftKey ? "⇧" : "",
      modifiers.metaKey ? "⌘" : "",
    ].join("");
    return `${symbols}${keyLabel}` || undefined;
  }

  const parts = [
    modifiers.ctrlKey ? "Ctrl" : "",
    modifiers.altKey ? "Alt" : "",
    modifiers.shiftKey ? "Shift" : "",
    modifiers.metaKey ? "Win" : "",
    keyLabel,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("+") : undefined;
};
