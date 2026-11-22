import { isIframeElement } from "./is-iframe-element.js";

const getFocusedFrameDocument = (ownerDocument: Document): Document | null => {
  const activeElement = ownerDocument.activeElement;
  return isIframeElement(activeElement) ? activeElement.contentDocument : null;
};

export const getFocusedDocument = (rootDocument: Document): Document => {
  let focusedDocument = rootDocument;
  let frameDocument = getFocusedFrameDocument(focusedDocument);
  while (frameDocument) {
    focusedDocument = frameDocument;
    frameDocument = getFocusedFrameDocument(focusedDocument);
  }
  return focusedDocument;
};
