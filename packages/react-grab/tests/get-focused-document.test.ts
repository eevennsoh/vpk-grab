import { describe, expect, it, vi } from "vite-plus/test";
import { getFocusedDocument } from "../src/utils/get-focused-document.js";

vi.mock("../src/utils/is-iframe-element.js", () => ({
  isIframeElement: (element: unknown) =>
    typeof element === "object" && element !== null && "contentDocument" in element,
}));

const createDocument = (activeElement: object | null): Document =>
  Object.assign(Object.create(null), { activeElement });

describe("getFocusedDocument", () => {
  it("returns the root document when focus is on one of its own elements", () => {
    const rootDocument = createDocument({ tagName: "BUTTON" });
    expect(getFocusedDocument(rootDocument)).toBe(rootDocument);
  });

  it("follows focus into a same-origin frame", () => {
    const frameDocument = createDocument({ tagName: "INPUT" });
    const rootDocument = createDocument({ contentDocument: frameDocument });
    expect(getFocusedDocument(rootDocument)).toBe(frameDocument);
  });

  it("follows focus through nested frames", () => {
    const innerDocument = createDocument(null);
    const outerDocument = createDocument({ contentDocument: innerDocument });
    const rootDocument = createDocument({ contentDocument: outerDocument });
    expect(getFocusedDocument(rootDocument)).toBe(innerDocument);
  });

  it("stops at a cross-origin frame, whose document is out of reach", () => {
    const rootDocument = createDocument({ contentDocument: null });
    expect(getFocusedDocument(rootDocument)).toBe(rootDocument);
  });
});
