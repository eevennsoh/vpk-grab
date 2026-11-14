import { readCssRules } from "./walk-style-rules.js";

interface CachedSheetRules<CollectedRules> {
  topLevelRuleCount: number;
  collectedRules: CollectedRules;
}

// Keyed by sheet and invalidated on its top-level rule count, so the walk over
// every rule runs once per stylesheet rather than on every read. A dev server
// swapping a <style> element produces a new sheet and a fresh entry.
export const createSheetRuleCache = <CollectedRules>(
  collectRules: (rules: CSSRuleList) => CollectedRules,
): ((sheet: CSSStyleSheet) => CollectedRules | null) => {
  const cachedRulesBySheet = new WeakMap<CSSStyleSheet, CachedSheetRules<CollectedRules>>();

  return (sheet) => {
    const rules = readCssRules(sheet);
    if (!rules) return null;

    const cached = cachedRulesBySheet.get(sheet);
    if (cached && cached.topLevelRuleCount === rules.length) return cached.collectedRules;

    const collectedRules = collectRules(rules);
    cachedRulesBySheet.set(sheet, { topLevelRuleCount: rules.length, collectedRules });
    return collectedRules;
  };
};
