import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getSpecKeywordOptions } from "../src/utils/spec-keyword-options.js";

describe("getSpecKeywordOptions", () => {
  beforeEach(() => {
    vi.stubGlobal("CSS", {
      supports: (property: string, value: string) =>
        !(property === "display" && value === "contents"),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("offers the keywords the browser takes for a property", () => {
    const options = getSpecKeywordOptions("display");
    expect(options).toContain("flex");
    expect(options).not.toContain("contents");
  });

  it("offers nothing for a property without keywords", () => {
    expect(getSpecKeywordOptions("padding")).toEqual([]);
  });
});
