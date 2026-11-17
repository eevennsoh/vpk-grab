import type { SelectionLabelInstance } from "../types.js";
import { isElementConnected } from "./is-element-connected.js";

export const hasLabelCompletionActions = (instance: SelectionLabelInstance): boolean =>
  (instance.status === "copied" || instance.status === "fading") &&
  isElementConnected(instance.element);
