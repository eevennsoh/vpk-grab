import { describe, expect, it } from "vite-plus/test";
import type { ElementSpecRow } from "../src/types.js";
import { getSpecTokenRows } from "../src/utils/get-spec-token-rows.js";

const row = (property: string, children?: ElementSpecRow[]): ElementSpecRow => ({
  property,
  value: "8px",
  isApplied: true,
  sectionTitle: "Spacing",
  children,
});
const padding = row("padding", [
  row("padding-top"),
  row("padding-right"),
  row("padding-bottom"),
  row("padding-left"),
]);
const margin = row("margin", [
  row("margin-top"),
  row("margin-right"),
  row("margin-bottom"),
  row("margin-left"),
]);
const sections = [{ title: "Spacing", rows: [padding, margin] }];

describe("getSpecTokenRows", () => {
  it("does the original row token work when every shorthand is collapsed", () => {
    expect(getSpecTokenRows(sections, new Set())).toEqual([padding, margin]);
  });

  it("includes only children of expanded properties", () => {
    expect(getSpecTokenRows(sections, new Set(["padding"]))).toEqual([
      padding,
      ...(padding.children ?? []),
      margin,
    ]);
  });

  it("leaves off rows and unapplied rows out of the lookup", () => {
    const offRow = {
      ...padding,
      override: { isOff: true, value: null, token: null },
      children: [],
    };
    const unappliedRow = { ...margin, isApplied: false };
    expect(
      getSpecTokenRows([{ title: "Spacing", rows: [offRow, unappliedRow] }], new Set()),
    ).toEqual([]);
  });
});
