import { describe, expect, it, vi } from "vite-plus/test";
import { getToolCycleDirection } from "../src/utils/get-tool-cycle-direction.js";

const platform = vi.hoisted(() => ({ isMac: true }));
vi.mock("../src/utils/is-mac.js", () => ({ isMac: () => platform.isMac }));

describe("getToolCycleDirection", () => {
  for (const isMac of [true, false]) {
    it(`recognizes only horizontal arrows with ${isMac ? "Meta" : "Control"} alone`, () => {
      platform.isMac = isMac;
      const chord = {
        key: "ArrowRight",
        metaKey: isMac,
        ctrlKey: !isMac,
        altKey: false,
        shiftKey: false,
      };
      expect(getToolCycleDirection(chord)).toBe("forward");
      expect(getToolCycleDirection({ ...chord, key: "ArrowLeft" })).toBe("backward");
      for (const key of ["ArrowUp", "ArrowDown", "Tab", "z"]) {
        expect(getToolCycleDirection({ ...chord, key })).toBeNull();
      }
      for (const modifiers of [
        { metaKey: false, ctrlKey: false },
        { metaKey: true, ctrlKey: true },
        { metaKey: !isMac, ctrlKey: isMac },
        { shiftKey: true },
        { altKey: true },
      ]) {
        expect(getToolCycleDirection({ ...chord, ...modifiers })).toBeNull();
      }
    });
  }
});
