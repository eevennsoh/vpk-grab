import type { ElementSpecRow, ElementSpecSection, GroupedSpecRows } from "../types.js";

const belongsToApplied = (row: ElementSpecRow): boolean =>
  row.isApplied || row.override !== undefined;

// Applied rows (and any row with an override) are gathered at the top in
// section order; the sections below keep only what is left, and a section
// with nothing left is dropped. With `frozenAppliedProperties` the applied
// group is the one the panel showed when it was pinned, so a row edited
// further down stays where it is until the panel opens again.
export const groupSpecRows = (
  sections: ElementSpecSection[],
  frozenAppliedProperties: string[] | null,
): GroupedSpecRows => {
  const allRows = sections.flatMap((section) => section.rows);
  const appliedRows = frozenAppliedProperties
    ? frozenAppliedProperties.flatMap((property) => {
        const row = allRows.find((candidateRow) => candidateRow.property === property);
        return row ? [row] : [];
      })
    : allRows.filter(belongsToApplied);
  const appliedProperties = new Set(appliedRows.map((row) => row.property));

  return {
    appliedRows,
    sections: sections
      .map((section) => ({
        title: section.title,
        rows: section.rows.filter((row) => !appliedProperties.has(row.property)),
      }))
      .filter((section) => section.rows.length > 0),
  };
};
