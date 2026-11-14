import { isShadowRoot } from "./is-shadow-root.js";

// The enabled stylesheets that can style an element: its shadow root's when it
// is in one, otherwise the document's, adopted sheets included.
export const getElementStyleSheets = (element: Element): CSSStyleSheet[] => {
  const rootNode = element.getRootNode();
  const styleScope = isShadowRoot(rootNode) ? rootNode : element.ownerDocument;
  return [...styleScope.styleSheets, ...(styleScope.adoptedStyleSheets ?? [])].filter(
    (sheet) => !sheet.disabled,
  );
};
