import { createSignal } from "solid-js";
import { isElementConnected } from "../utils/is-element-connected.js";

interface KeyboardSelectionController {
  selectedElement: () => Element | null;
  select: (element: Element) => void;
  clear: () => void;
  takeSelection: (fallbackElement?: Element | null) => Element | null;
}

export const createKeyboardSelectionController = (): KeyboardSelectionController => {
  const [selectedElement, setSelectedElement] = createSignal<Element | null>(null);

  const connectedSelection = (): Element | null => {
    const element = selectedElement();
    return isElementConnected(element) ? element : null;
  };

  const clear = () => {
    setSelectedElement(null);
  };

  const takeSelection = (fallbackElement?: Element | null): Element | null => {
    const element =
      connectedSelection() ?? (isElementConnected(fallbackElement) ? fallbackElement : null);
    clear();
    return element;
  };

  return {
    selectedElement: connectedSelection,
    select: setSelectedElement,
    clear,
    takeSelection,
  };
};
