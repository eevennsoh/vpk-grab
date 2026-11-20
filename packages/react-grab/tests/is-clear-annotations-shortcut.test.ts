import { describe, expect, it, vi } from "vite-plus/test";
import { isClearAnnotationsShortcut } from "../src/utils/is-clear-annotations-shortcut.js";

const platform = vi.hoisted(() => ({ isMac: true }));
vi.mock("../src/utils/is-mac.js", () => ({ isMac: () => platform.isMac }));

describe("isClearAnnotationsShortcut", () => {
  for (const isMac of [true, false]) {
    it(`recognizes Backspace and Delete with ${isMac ? "Meta" : "Control"} alone`, () => {
      platform.isMac = isMac;
      const chord = {
        key: "Backspace",
        metaKey: isMac,
        ctrlKey: !isMac,
        altKey: false,
        shiftKey: false,
      };
      expect(isClearAnnotationsShortcut(chord)).toBe(true);
      expect(isClearAnnotationsShortcut({ ...chord, key: "Delete" })).toBe(true);
      for (const key of ["Escape", "x", "z"]) {
        expect(isClearAnnotationsShortcut({ ...chord, key })).toBe(false);
      }
      for (const modifiers of [
        { metaKey: false, ctrlKey: false },
        { metaKey: true, ctrlKey: true },
        { metaKey: !isMac, ctrlKey: isMac },
        { shiftKey: true },
        { altKey: true },
      ]) {
        expect(isClearAnnotationsShortcut({ ...chord, ...modifiers })).toBe(false);
      }
    });
  }
});
