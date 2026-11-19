import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AnnotationTool } from "../src/types.js";
import { getSelectionToolShortcut } from "../src/utils/get-selection-tool-shortcut.js";

const platform = vi.hoisted(() => ({ isMac: true }));
vi.mock("../src/utils/is-mac.js", () => ({ isMac: () => platform.isMac }));
afterEach(() => {
  platform.isMac = true;
});

describe("getSelectionToolShortcut", () => {
  it("shows only activation before activation", () => {
    for (const isToolbarVertical of [false, true]) {
      expect(getSelectionToolShortcut("grab", "grab", false, "⌘C", isToolbarVertical)).toBe("⌘C");
      expect(
        getSelectionToolShortcut("rectangle", "grab", false, "⌘C", isToolbarVertical),
      ).toBeUndefined();
    }
  });

  it("shows Right and Left from Grab on a horizontal toolbar and no key for Rectangle", () => {
    expect(getSelectionToolShortcut("pen", "grab", true, "⌘C", false)).toBe("⌘→");
    expect(getSelectionToolShortcut("rectangle", "grab", true, "⌘C", false)).toBeUndefined();
    expect(getSelectionToolShortcut("text", "grab", true, "⌘C", false)).toBe("⌘←");
    expect(getSelectionToolShortcut("grab", "grab", true, "⌘C", false)).toBeUndefined();
  });

  it("shows Down and Up from Grab on a vertical toolbar", () => {
    expect(getSelectionToolShortcut("pen", "grab", true, "⌘C", true)).toBe("⌘↓");
    expect(getSelectionToolShortcut("rectangle", "grab", true, "⌘C", true)).toBeUndefined();
    expect(getSelectionToolShortcut("text", "grab", true, "⌘C", true)).toBe("⌘↑");
    expect(getSelectionToolShortcut("grab", "grab", true, "⌘C", true)).toBeUndefined();
  });

  it("shows Ctrl with the arrows on other platforms", () => {
    platform.isMac = false;
    expect(getSelectionToolShortcut("pen", "grab", true, "Ctrl+C", false)).toBe("Ctrl+→");
    expect(getSelectionToolShortcut("text", "grab", true, "Ctrl+C", false)).toBe("Ctrl+←");
    expect(getSelectionToolShortcut("pen", "grab", true, "Ctrl+C", true)).toBe("Ctrl+↓");
    expect(getSelectionToolShortcut("text", "grab", true, "Ctrl+C", true)).toBe("Ctrl+↑");
  });

  it("shows drawing numbers from every drawing tool and Move, including the current tool", () => {
    const currentTools: AnnotationTool[] = ["pen", "rectangle", "text", "edit"];
    for (const isToolbarVertical of [false, true]) {
      for (const currentTool of currentTools) {
        expect(getSelectionToolShortcut("pen", currentTool, true, "⌘C", isToolbarVertical)).toBe(
          "1",
        );
        expect(
          getSelectionToolShortcut("rectangle", currentTool, true, "⌘C", isToolbarVertical),
        ).toBe("2");
        expect(getSelectionToolShortcut("text", currentTool, true, "⌘C", isToolbarVertical)).toBe(
          "3",
        );
      }
    }
  });

  it("shows the arrow back to Grab from Text and on to Grab from Move", () => {
    expect(getSelectionToolShortcut("grab", "text", true, "⌘C", false)).toBe("⌘→");
    expect(getSelectionToolShortcut("grab", "pen", true, "⌘C", true)).toBe("⌘↑");
    expect(getSelectionToolShortcut("grab", "edit", true, "⌘C", true)).toBe("⌘↓");
  });
});
