import { describe, expect, it } from "vite-plus/test";
import type { ElementSpecRow, ElementSpecSection } from "../src/types.js";
import { mergeDisabledSpecRows } from "../src/utils/merge-disabled-spec-rows.js";

const row = (property: string, value: string, isApplied: boolean): ElementSpecRow => ({
  property,
  value,
  isApplied,
});

const createSections = (): ElementSpecSection[] => [
  {
    title: "Spacing",
    rows: [row("margin", "0px", false), row("padding", "0px", false), row("gap", "normal", false)],
  },
  { title: "Layout", rows: [row("display", "block", false)] },
];

describe("mergeDisabledSpecRows", () => {
  it("returns the sections untouched when nothing is switched off", () => {
    const sections = createSections();
    expect(mergeDisabledSpecRows(sections, [])).toBe(sections);
  });

  it("shows a switched-off row as it stood, marked disabled", () => {
    const merged = mergeDisabledSpecRows(createSections(), [
      {
        sectionTitle: "Spacing",
        rowIndex: 1,
        row: { ...row("padding", "8px 12px", true), tokens: ["--space × 4"] },
      },
    ]);

    expect(merged[0].rows[1]).toEqual({
      property: "padding",
      value: "8px 12px",
      isApplied: false,
      isDisabled: true,
      tokens: ["--space × 4"],
    });
    expect(merged[0].rows).toHaveLength(3);
  });

  it("puts back a conditional row that vanished with its property", () => {
    const merged = mergeDisabledSpecRows(createSections(), [
      { sectionTitle: "Layout", rowIndex: 1, row: row("flex-direction", "column", true) },
      { sectionTitle: "Layout", rowIndex: 0, row: row("display", "flex", true) },
    ]);

    expect(merged[1].rows.map(({ property, value }) => [property, value])).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
    ]);
  });

  it("puts back a section that vanished with its last applied row", () => {
    const merged = mergeDisabledSpecRows(createSections(), [
      { sectionTitle: "Typography", rowIndex: 5, row: row("color", "#FFFFFF", true) },
    ]);

    expect(merged.map(({ title }) => title)).toEqual(["Spacing", "Layout", "Typography"]);
    expect(merged[2].rows).toEqual([
      { property: "color", value: "#FFFFFF", isApplied: false, isDisabled: true },
    ]);
  });

  it("does not modify the sections it was given", () => {
    const sections = createSections();
    mergeDisabledSpecRows(sections, [
      { sectionTitle: "Spacing", rowIndex: 1, row: row("padding", "8px", true) },
    ]);
    expect(sections).toEqual(createSections());
  });
});
