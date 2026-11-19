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
    expect(getSelectionToolShortcut("grab", "grab", false, "⌘C")).toBe("⌘C");
    expect(getSelectionToolShortcut("rectangle", "grab", false, "⌘C")).toBeUndefined();
  });

  it("shows adjacent modifier-arrow shortcuts from Grab and no key for Rectangle", () => {
    expect(getSelectionToolShortcut("pen", "grab", true, "⌘C")).toBe("⌘→");
    expect(getSelectionToolShortcut("rectangle", "grab", true, "⌘C")).toBeUndefined();
    expect(getSelectionToolShortcut("text", "grab", true, "⌘C")).toBe("⌘←");
    expect(getSelectionToolShortcut("grab", "grab", true, "⌘C")).toBeUndefined();
  });

  it("shows Ctrl with Right and Left on other platforms", () => {
    platform.isMac = false;
    expect(getSelectionToolShortcut("pen", "grab", true, "Ctrl+C")).toBe("Ctrl+→");
    expect(getSelectionToolShortcut("text", "grab", true, "Ctrl+C")).toBe("Ctrl+←");
  });

  it("shows drawing numbers from every drawing tool and Move, including the current tool", () => {
    const currentTools: AnnotationTool[] = ["pen", "rectangle", "text", "edit"];
    for (const currentTool of currentTools) {
      expect(getSelectionToolShortcut("pen", currentTool, true, "⌘C")).toBe("1");
      expect(getSelectionToolShortcut("rectangle", currentTool, true, "⌘C")).toBe("2");
      expect(getSelectionToolShortcut("text", currentTool, true, "⌘C")).toBe("3");
    }
  });
});
