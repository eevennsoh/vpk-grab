import type { ElementSpecRow, ElementSpecSection } from "../types.js";

export const getSpecTokenRows = (
  sections: ElementSpecSection[],
  expandedProperties: ReadonlySet<string>,
): ElementSpecRow[] =>
  sections.flatMap((section) =>
    section.rows
      .flatMap((row) => [
        row,
        ...(expandedProperties.has(row.property) ? (row.children ?? []) : []),
      ])
      .filter((row) => (row.override ? !row.override.isOff : row.isApplied)),
  );
