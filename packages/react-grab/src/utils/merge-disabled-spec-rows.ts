import type { DisabledSpecRow, ElementSpecSection } from "../types.js";

// A property switched off in the panel no longer computes to anything worth
// listing, and a conditional row (or a whole section) can disappear with it.
// The row as it stood when it was switched off is put back where it was, so
// there is still something to switch on again.
export const mergeDisabledSpecRows = (
  sections: ElementSpecSection[],
  disabledRows: DisabledSpecRow[],
): ElementSpecSection[] => {
  if (disabledRows.length === 0) return sections;

  const mergedSections = sections.map((section) => ({ ...section, rows: [...section.rows] }));
  const rowsInOriginalOrder = [...disabledRows].sort(
    (first, second) => first.rowIndex - second.rowIndex,
  );

  for (const disabledRow of rowsInOriginalOrder) {
    let section = mergedSections.find(({ title }) => title === disabledRow.sectionTitle);
    if (!section) {
      section = { title: disabledRow.sectionTitle, rows: [] };
      mergedSections.push(section);
    }
    const row = { ...disabledRow.row, isApplied: false, isDisabled: true };
    const existingIndex = section.rows.findIndex(
      ({ property }) => property === disabledRow.row.property,
    );
    if (existingIndex === -1) {
      section.rows.splice(Math.min(disabledRow.rowIndex, section.rows.length), 0, row);
    } else {
      section.rows[existingIndex] = row;
    }
  }

  return mergedSections;
};
