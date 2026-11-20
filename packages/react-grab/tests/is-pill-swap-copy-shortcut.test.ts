import { describe, expect, it, vi } from "vite-plus/test";
import { isPillSwapCopyShortcut } from "../src/utils/is-pill-swap-copy-shortcut.js";

const platform = vi.hoisted(() => ({ isMac: true }));
vi.mock("../src/utils/is-mac.js", () => ({ isMac: () => platform.isMac }));

describe("isPillSwapCopyShortcut", () => {
  for (const isMac of [true, false]) {
    it(`recognizes Enter with ${isMac ? "Meta" : "Control"} alone`, () => {
      platform.isMac = isMac;
      const chord = {
        code: "Enter",
        metaKey: isMac,
        ctrlKey: !isMac,
        altKey: false,
        shiftKey: false,
      };
      expect(isPillSwapCopyShortcut(chord)).toBe(true);
      expect(isPillSwapCopyShortcut({ ...chord, code: "NumpadEnter" })).toBe(true);
      expect(isPillSwapCopyShortcut({ ...chord, code: "KeyC" })).toBe(false);
      for (const modifiers of [
        { metaKey: false, ctrlKey: false },
        { metaKey: true, ctrlKey: true },
        { metaKey: !isMac, ctrlKey: isMac },
        { shiftKey: true },
        { altKey: true },
      ]) {
        expect(isPillSwapCopyShortcut({ ...chord, ...modifiers })).toBe(false);
      }
    });
  }
});
