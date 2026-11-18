import type { SelectionLabelInstance } from "../types.js";

export const doesLabelInstanceCoverElement = (
  instance: SelectionLabelInstance,
  element: Element,
): boolean => instance.element === element || Boolean(instance.elements?.includes(element));
