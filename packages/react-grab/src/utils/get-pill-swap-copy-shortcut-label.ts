import { PILL_SWAP_COPY_SHORTCUT_LABEL, PILL_SWAP_COPY_SHORTCUT_LABEL_MAC } from "../constants.js";
import { isMac } from "./is-mac.js";

export const getPillSwapCopyShortcutLabel = (): string =>
  isMac() ? PILL_SWAP_COPY_SHORTCUT_LABEL_MAC : PILL_SWAP_COPY_SHORTCUT_LABEL;
