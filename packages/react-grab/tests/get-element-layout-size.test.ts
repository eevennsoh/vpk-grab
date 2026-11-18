import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getElementLayoutSize } from "../src/utils/get-element-layout-size.js";

class LayoutElement {
  offsetWidth = 200;
  offsetHeight = 100;
  getBoundingClientRect = vi.fn(() => ({ width: 300, height: 250 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("getElementLayoutSize", () => {
  it("reads the untransformed layout size of HTML elements without a rectangle read", () => {
    vi.stubGlobal("HTMLElement", LayoutElement);
    const element = new LayoutElement();
    expect(getElementLayoutSize(element as unknown as Element)).toEqual({
      width: 200,
      height: 100,
    });
    expect(element.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("falls back to bounds for elements without HTML layout dimensions", () => {
    vi.stubGlobal("HTMLElement", LayoutElement);
    const element = { getBoundingClientRect: () => ({ width: 300, height: 250 }) };
    expect(getElementLayoutSize(element as unknown as Element)).toEqual({
      width: 300,
      height: 250,
    });
  });
});
