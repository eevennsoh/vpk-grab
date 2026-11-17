interface ElementLayoutSize {
  width: number;
  height: number;
}

export const getElementLayoutSize = (element: Element): ElementLayoutSize =>
  element instanceof HTMLElement
    ? { width: element.offsetWidth, height: element.offsetHeight }
    : element.getBoundingClientRect();
