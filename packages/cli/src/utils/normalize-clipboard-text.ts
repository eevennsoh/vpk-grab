export const normalizeClipboardText = (text?: string): string =>
  text?.replaceAll("\r\n", "\n") ?? "";
