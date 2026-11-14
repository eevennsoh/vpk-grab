import { describe, expect, it } from "vite-plus/test";
import type { StyleOverride } from "../src/types.js";
import { groupStyleOverrides } from "../src/utils/group-style-overrides.js";

const firstElement = {} as Element;
const secondElement = {} as Element;

const override = (element: Element, property: string): StyleOverride => ({
  element,
  property,
  original: { property, sectionTitle: "Spacing", value: "0px", isApplied: true },
  isOff: true,
  value: null,
  token: null,
});

describe("groupStyleOverrides", () => {
  it("groups overrides by element in the order each was first changed", () => {
    const groups = groupStyleOverrides([
      override(firstElement, "padding"),
      override(secondElement, "color"),
      override(firstElement, "margin"),
    ]);
    expect(groups.map((group) => group.element)).toEqual([firstElement, secondElement]);
    expect(groups[0].overrides.map((entry) => entry.property)).toEqual(["padding", "margin"]);
  });

  it("returns no groups when nothing is changed", () => {
    expect(groupStyleOverrides([])).toEqual([]);
  });
});
