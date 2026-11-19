import { afterEach, expect, it, vi } from "vite-plus/test";
import { isKeyboardEventTriggeredByInput } from "../src/utils/is-keyboard-event-triggered-by-input.js";

afterEach(() => vi.unstubAllGlobals());

it("recognizes editable keyboard targets from a different document", () => {
  vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
  vi.stubGlobal("document", { designMode: "off" });
  const frameDocument = { designMode: "off" };
  const target = Object.assign(new EventTarget(), {
    namespaceURI: "http://www.w3.org/1999/xhtml",
    nodeType: Node.ELEMENT_NODE,
    ownerDocument: frameDocument,
    tagName: "INPUT",
  });
  const event = new Event("keydown", { composed: true });
  vi.spyOn(event, "composedPath").mockReturnValue([target]);
  expect(isKeyboardEventTriggeredByInput(event)).toBe(true);
  target.tagName = "DIV";
  expect(isKeyboardEventTriggeredByInput(event)).toBe(false);
  frameDocument.designMode = "on";
  expect(isKeyboardEventTriggeredByInput(event)).toBe(true);
});
