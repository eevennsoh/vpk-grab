import { describe, expect, it } from "vite-plus/test";
import { getPhysicalSpecProperty } from "../src/utils/get-physical-spec-property.js";

describe("getPhysicalSpecProperty", () => {
  it("keeps physical properties and shorthands unchanged", () => {
    for (const property of [
      "padding",
      "padding-left",
      "border-top-width",
      "border-top-left-radius",
      "width",
    ])
      expect(getPhysicalSpecProperty(property, "horizontal-tb", "ltr")).toBe(property);
  });
  it("maps logical sides using writing mode and direction", () => {
    expect(getPhysicalSpecProperty("padding-inline-start", "horizontal-tb", "ltr")).toBe(
      "padding-left",
    );
    expect(getPhysicalSpecProperty("padding-inline-start", "horizontal-tb", "rtl")).toBe(
      "padding-right",
    );
    expect(getPhysicalSpecProperty("margin-inline-end", "vertical-rl", "ltr")).toBe(
      "margin-bottom",
    );
    expect(getPhysicalSpecProperty("margin-inline-end", "vertical-lr", "rtl")).toBe("margin-top");
    expect(getPhysicalSpecProperty("border-block-start-width", "vertical-rl", "ltr")).toBe(
      "border-right-width",
    );
    expect(getPhysicalSpecProperty("border-block-end-width", "vertical-lr", "ltr")).toBe(
      "border-right-width",
    );
    expect(getPhysicalSpecProperty("padding-inline-start", "sideways-lr", "ltr")).toBe(
      "padding-bottom",
    );
  });
  it("maps logical corner radii to physical corners", () => {
    expect(getPhysicalSpecProperty("border-start-start-radius", "horizontal-tb", "ltr")).toBe(
      "border-top-left-radius",
    );
    expect(getPhysicalSpecProperty("border-end-end-radius", "horizontal-tb", "rtl")).toBe(
      "border-bottom-left-radius",
    );
    expect(getPhysicalSpecProperty("border-start-end-radius", "vertical-rl", "ltr")).toBe(
      "border-bottom-right-radius",
    );
    expect(getPhysicalSpecProperty("border-end-start-radius", "vertical-lr", "rtl")).toBe(
      "border-bottom-right-radius",
    );
  });
});
