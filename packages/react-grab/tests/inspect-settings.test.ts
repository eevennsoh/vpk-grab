import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ANNOTATION_COLOR_OPTIONS, ANNOTATION_RED_COLOR } from "../src/constants.js";
import { loadInspectSettings, saveInspectSettings } from "../src/utils/inspect-settings.js";

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
      isAutoScreenshotEnabled: false,
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

describe("loadInspectSettings screenshot toggle", () => {
  it("starts off when nothing is stored", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(loadInspectSettings().isAutoScreenshotEnabled).toBe(false);
  });

  it("reads a stored choice and ignores anything but true", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ isAutoScreenshotEnabled: true }),
    });
    expect(loadInspectSettings().isAutoScreenshotEnabled).toBe(true);
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ isAutoScreenshotEnabled: "yes" }),
    });
    expect(loadInspectSettings().isAutoScreenshotEnabled).toBe(false);
  });
});

describe("saveInspectSettings screenshot toggle", () => {
  it("stores the choice beside Specs and Spacing", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    saveInspectSettings({
      isSpecsEnabled: false,
      isRedlinesEnabled: true,
      isAutoScreenshotEnabled: true,
      annotationColor: ANNOTATION_RED_COLOR,
    });
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({
      isSpecsEnabled: false,
      isRedlinesEnabled: true,
      isAutoScreenshotEnabled: true,
      annotationColor: ANNOTATION_RED_COLOR,
    });
  });
});
