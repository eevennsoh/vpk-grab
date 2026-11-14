import { describe, expect, it } from "vite-plus/test";
import { isSpecSourceProperty } from "../src/utils/is-spec-source-property.js";

describe("isSpecSourceProperty", () => {
  it("accepts the shorthand, axis and side forms that feed a box row", () => {
    for (const cssProperty of [
      "padding",
      "padding-inline",
      "padding-block-start",
      "padding-left",
    ]) {
      expect(isSpecSourceProperty("padding", cssProperty)).toBe(true);
    }
    expect(isSpecSourceProperty("padding", "margin")).toBe(false);
    expect(isSpecSourceProperty("margin", "margin-inline-end")).toBe(true);
  });

  it("splits the border shorthands between colour, width and style rows", () => {
    expect(isSpecSourceProperty("border-color", "border")).toBe(true);
    expect(isSpecSourceProperty("border-color", "border-top")).toBe(true);
    expect(isSpecSourceProperty("border-color", "border-inline-start-color")).toBe(true);
    expect(isSpecSourceProperty("border-color", "border-top-width")).toBe(false);
    expect(isSpecSourceProperty("border-width", "border-top-width")).toBe(true);
    expect(isSpecSourceProperty("border-style", "border-image-source")).toBe(false);
  });

  it("matches physical and logical corner radii", () => {
    expect(isSpecSourceProperty("border-radius", "border-radius")).toBe(true);
    expect(isSpecSourceProperty("border-radius", "border-top-left-radius")).toBe(true);
    expect(isSpecSourceProperty("border-radius", "border-start-start-radius")).toBe(true);
    expect(isSpecSourceProperty("border-radius", "border-color")).toBe(false);
  });

  it("maps inset, overflow, gap and size rows to their sources", () => {
    expect(isSpecSourceProperty("inset", "top")).toBe(true);
    expect(isSpecSourceProperty("inset", "inset-inline")).toBe(true);
    expect(isSpecSourceProperty("overflow", "overflow-x")).toBe(true);
    expect(isSpecSourceProperty("overflow", "overflow-wrap")).toBe(false);
    expect(isSpecSourceProperty("gap", "column-gap")).toBe(true);
    expect(isSpecSourceProperty("width", "inline-size")).toBe(true);
    expect(isSpecSourceProperty("width", "min-width")).toBe(false);
  });

  it("lets the background and font shorthands feed their rows", () => {
    expect(isSpecSourceProperty("background-color", "background")).toBe(true);
    expect(isSpecSourceProperty("font-size", "font")).toBe(true);
    expect(isSpecSourceProperty("line-height", "font")).toBe(true);
    expect(isSpecSourceProperty("font-size", "font-weight")).toBe(false);
  });

  it("falls back to the property the row is named after", () => {
    expect(isSpecSourceProperty("opacity", "opacity")).toBe(true);
    expect(isSpecSourceProperty("box-shadow", "box-shadow")).toBe(true);
    expect(isSpecSourceProperty("color", "background-color")).toBe(false);
  });
});
