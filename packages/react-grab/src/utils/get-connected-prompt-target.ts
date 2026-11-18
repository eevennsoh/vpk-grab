import type { PromptCopyTarget } from "../types.js";
import { isElementConnected } from "./is-element-connected.js";

export const getConnectedPromptTarget = (
  promptTarget: PromptCopyTarget,
): PromptCopyTarget | null => {
  const connectedElements = promptTarget.elements.filter(isElementConnected);
  const primaryElement = isElementConnected(promptTarget.primaryElement)
    ? promptTarget.primaryElement
    : connectedElements[0];
  if (!primaryElement) return null;
  return {
    primaryElement,
    elements: connectedElements.length > 0 ? connectedElements : [primaryElement],
  };
};
