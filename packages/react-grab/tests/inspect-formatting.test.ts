import { describe, expect, it } from "vite-plus/test";
import { collapseCssBoxSides } from "../src/utils/collapse-css-box-sides.js";
import { formatCssColor, isTransparentCssColor } from "../src/utils/format-css-color.js";
import { formatCssNumber } from "../src/utils/format-css-number.js";
import { splitSelectorList } from "../src/utils/split-selector-list.js";

describe("collapseCssBoxSides", () => {
  it("writes four sides the way the shorthand would", () => {
    expect(collapseCssBoxSides("8px", "8px", "8px", "8px")).toBe("8px");
    expect(collapseCssBoxSides("8px", "12px", "8px", "12px")).toBe("8px 12px");
    expect(collapseCssBoxSides("8px", "12px", "4px", "12px")).toBe("8px 12px 4px");
    expect(collapseCssBoxSides("8px", "12px", "4px", "2px")).toBe("8px 12px 4px 2px");
    expect(collapseCssBoxSides("8px", "12px", "8px", "2px")).toBe("8px 12px 8px 2px");
  });
});

describe("formatCssNumber", () => {
  it("rounds layout noise out of computed lengths", () => {
    expect(formatCssNumber("12.800000190734863px")).toBe("12.8px");
    expect(formatCssNumber("0px 1.3333px 3px -0.5px")).toBe("0px 1.33px 3px -0.5px");
    expect(formatCssNumber("16px")).toBe("16px");
  });
});

describe("formatCssColor", () => {
  it("shows opaque rgb as hex", () => {
    expect(formatCssColor("rgb(223, 225, 230)")).toBe("#DFE1E6");
  });

  it("keeps the alpha of a translucent colour", () => {
    expect(formatCssColor("rgba(11, 18, 14, 0.14)")).toBe("#0B120E / 14%");
    expect(formatCssColor("rgb(11 18 14 / 50%)")).toBe("#0B120E / 50%");
  });

  it("leaves a colour it cannot convert as written", () => {
    expect(formatCssColor("oklch(0.21 0.034 264.665)")).toBe("oklch(0.21 0.034 264.665)");
  });
});

describe("isTransparentCssColor", () => {
  it("recognises a fully transparent fill", () => {
    expect(isTransparentCssColor("rgba(0, 0, 0, 0)")).toBe(true);
    expect(isTransparentCssColor("transparent")).toBe(true);
    expect(isTransparentCssColor("oklch(0 0 0 / 0)")).toBe(true);
    expect(isTransparentCssColor("rgba(0, 0, 0, 0.5)")).toBe(false);
    expect(isTransparentCssColor("rgb(0, 0, 0)")).toBe(false);
    expect(isTransparentCssColor("oklch(0.5 0.1 20)")).toBe(false);
  });
});

describe("splitSelectorList", () => {
  it("splits on top-level commas only", () => {
    expect(splitSelectorList(".a, .b:is(.c, .d) , [data-x='1,2']")).toEqual([
      ".a",
      ".b:is(.c, .d)",
      "[data-x='1,2']",
    ]);
  });

  it("does not split on an escaped comma", () => {
    expect(splitSelectorList(".w-\\[1\\,2\\], .b")).toEqual([".w-\\[1\\,2\\]", ".b"]);
  });
});
