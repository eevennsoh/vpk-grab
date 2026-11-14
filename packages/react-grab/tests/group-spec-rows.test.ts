import { describe, expect, it } from "vite-plus/test";
import type { ElementSpecRow, ElementSpecSection } from "../src/types.js";
import { groupSpecRows } from "../src/utils/group-spec-rows.js";

const row = (
  property: string,
  sectionTitle: string,
  isApplied: boolean,
  override?: ElementSpecRow["override"],
): ElementSpecRow => ({ property, sectionTitle, value: "0px", isApplied, override });

const createSections = (): ElementSpecSection[] => [
  {
    title: "Appearance",
    rows: [row("background-color", "Appearance", true), row("opacity", "Appearance", false)],
  },
  {
    title: "Spacing",
    rows: [row("margin", "Spacing", false), row("padding", "Spacing", true)],
  },
  { title: "Layout", rows: [row("display", "Layout", true)] },
];

const properties = (rows: ElementSpecRow[]) => rows.map((specRow) => specRow.property);

describe("groupSpecRows", () => {
  it("gathers applied rows at the top in section order", () => {
    const grouped = groupSpecRows(createSections(), null);
    expect(properties(grouped.appliedRows)).toEqual(["background-color", "padding", "display"]);
    expect(grouped.sections.map((section) => section.title)).toEqual(["Appearance", "Spacing"]);
    expect(properties(grouped.sections[1].rows)).toEqual(["margin"]);
  });

  it("drops a section with nothing left in it", () => {
    const grouped = groupSpecRows(createSections(), null);
    expect(grouped.sections.find((section) => section.title === "Layout")).toBeUndefined();
  });

  it("keeps a row switched off among the applied rows", () => {
    const sections = createSections();
    sections[1].rows[1] = row("padding", "Spacing", false, {
      isOff: true,
      value: null,
      token: null,
    });
    expect(properties(groupSpecRows(sections, null).appliedRows)).toContain("padding");
  });

  it("puts any overridden row among the applied rows", () => {
    const sections = createSections();
    sections[1].rows[0] = row("margin", "Spacing", false, {
      isOff: false,
      value: "4px",
      token: null,
    });
    expect(properties(groupSpecRows(sections, null).appliedRows)).toEqual([
      "background-color",
      "margin",
      "padding",
      "display",
    ]);
  });

  it("holds the frozen applied group while an edited lower row stays put", () => {
    const sections = createSections();
    sections[1].rows[0] = row("margin", "Spacing", false, {
      isOff: false,
      value: "4px",
      token: null,
    });
    const grouped = groupSpecRows(sections, ["background-color", "padding", "display"]);
    expect(properties(grouped.appliedRows)).toEqual(["background-color", "padding", "display"]);
    expect(properties(grouped.sections[1].rows)).toEqual(["margin"]);
  });

  it("skips frozen properties the element no longer lists", () => {
    const grouped = groupSpecRows(createSections(), ["gap", "padding"]);
    expect(properties(grouped.appliedRows)).toEqual(["padding"]);
  });
});
