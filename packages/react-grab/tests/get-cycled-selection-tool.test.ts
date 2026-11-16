import { describe, expect, it } from "vite-plus/test";
import { getCycledSelectionTool } from "../src/utils/get-cycled-selection-tool.js";

describe("getCycledSelectionTool", () => {
  it("steps forward through Grab, Pen and Text and wraps to Grab", () => {
    expect(getCycledSelectionTool("grab", "forward")).toBe("pen");
    expect(getCycledSelectionTool("pen", "forward")).toBe("text");
    expect(getCycledSelectionTool("text", "forward")).toBe("grab");
  });

  it("steps backward and wraps to Text", () => {
    expect(getCycledSelectionTool("grab", "backward")).toBe("text");
    expect(getCycledSelectionTool("text", "backward")).toBe("pen");
    expect(getCycledSelectionTool("pen", "backward")).toBe("grab");
  });

  it("treats Move as just after Text", () => {
    expect(getCycledSelectionTool("edit", "forward")).toBe("grab");
    expect(getCycledSelectionTool("edit", "backward")).toBe("text");
  });
});
