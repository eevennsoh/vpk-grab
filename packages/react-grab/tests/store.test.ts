import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createGrabStore } from "../src/core/store.js";
import { OFFSCREEN_POSITION } from "../src/constants.js";

vi.mock("../src/core/element-anchors.js", () => ({
  trackElementAnchor: () => {},
  resolveLiveElement: (element: Element) => element,
}));

afterEach(() => vi.unstubAllGlobals());

describe("finishJustCopied", () => {
  for (const wasActivatedByToggle of [true, false]) {
    it(`returns an active session to hovering (toggle: ${wasActivatedByToggle})`, () => {
      const focusedElement = Object.create(null);
      vi.stubGlobal("document", { activeElement: focusedElement });
      vi.stubGlobal("window", { scrollX: 0, scrollY: 0 });
      const { actions, store, current } = createGrabStore({
        keyHoldDuration: 0,
        onActivate: () => {},
      });
      actions.activate();
      actions.setWasActivatedByToggle(wasActivatedByToggle);
      const activationTimestamp = store.activationTimestamp;
      actions.startDrag({ x: 20, y: 30 });
      actions.setFrozenElements([focusedElement]);
      actions.setFrozenDragRect({ pageX: 20, pageY: 30, width: 40, height: 50 });
      actions.startCopy();
      actions.completeCopy();
      actions.finishJustCopied();

      expect(current()).toEqual({
        state: "active",
        phase: "hovering",
        isPromptMode: false,
        isPendingDismiss: false,
      });
      expect(store.frozenElement).toBeNull();
      expect(store.frozenElements).toEqual([]);
      expect(store.frozenDragRect).toBeNull();
      expect(store.dragStart).toEqual({ x: OFFSCREEN_POSITION, y: OFFSCREEN_POSITION });
      expect(store.previouslyFocusedElement).toBe(focusedElement);
      expect(store.activationTimestamp).toBe(activationTimestamp);
      expect(store.wasActivatedByToggle).toBe(wasActivatedByToggle);
    });
  }

  it("keeps a copy started while inactive inactive", () => {
    const { actions, current } = createGrabStore({ keyHoldDuration: 0, onActivate: () => {} });
    actions.startCopy();
    actions.completeCopy();
    actions.finishJustCopied();
    expect(current()).toEqual({ state: "idle" });
  });

  it("does not revive a session deactivated during a copy", () => {
    vi.stubGlobal("document", { activeElement: null });
    const { actions, current } = createGrabStore({ keyHoldDuration: 0, onActivate: () => {} });
    actions.activate();
    actions.startCopy();
    actions.deactivate();
    actions.finishJustCopied();
    expect(current()).toEqual({ state: "idle" });
  });
});
