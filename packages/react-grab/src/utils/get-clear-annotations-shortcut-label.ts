import {
  CLEAR_ANNOTATIONS_SHORTCUT_LABEL,
  CLEAR_ANNOTATIONS_SHORTCUT_LABEL_MAC,
} from "../constants.js";
import { isMac } from "./is-mac.js";

export const getClearAnnotationsShortcutLabel = (): string =>
  isMac() ? CLEAR_ANNOTATIONS_SHORTCUT_LABEL_MAC : CLEAR_ANNOTATIONS_SHORTCUT_LABEL;
