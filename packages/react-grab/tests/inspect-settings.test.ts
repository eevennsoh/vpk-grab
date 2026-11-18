import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ANNOTATION_COLOR_OPTIONS, ANNOTATION_RED_COLOR } from "../src/constants.js";
import { loadInspectSettings } from "../src/utils/inspect-settings.js";

afterEach(() => vi.unstubAllGlobals());

describe("loadInspectSettings annotation color", () => {
  it("falls back from removed Blue to Red at the read boundary", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ annotationColor: "#0d99ff", isSpecsEnabled: true }),
    });
    expect(loadInspectSettings()).toEqual({
      annotationColor: ANNOTATION_RED_COLOR,
      isSpecsEnabled: true,
      isRedlinesEnabled: false,
    });
  });

  it("keeps every current palette color", () => {
    for (const option of ANNOTATION_COLOR_OPTIONS) {
      vi.stubGlobal("localStorage", {
        getItem: () => JSON.stringify({ annotationColor: option.value }),
      });
      expect(loadInspectSettings().annotationColor).toBe(option.value);
    }
  });
});
