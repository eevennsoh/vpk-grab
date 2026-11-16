const COMMAND_SYMBOL = "⌘";

// The text around each Command symbol, so the symbol can be drawn as React
// Grab's command icon the way its menus show shortcuts: "⇧⌘" becomes
// ["⇧", ""] and "⌘C" becomes ["", "C"], with the icon between the parts.
export const splitShortcutAtCommand = (shortcut: string): string[] =>
  shortcut.split(COMMAND_SYMBOL);
