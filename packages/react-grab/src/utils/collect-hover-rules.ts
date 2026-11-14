import { splitSelectorList } from "./split-selector-list.js";
import { walkStyleRules } from "./walk-style-rules.js";

export interface HoverRule {
  selector: string;
  propertyNames: string[];
}

const HOVER_PSEUDO_CLASS = ":hover";
const PSEUDO_ELEMENT_PREFIX = "::";

// Every style rule whose selector depends on `:hover`, with nesting flattened
// into a selector querySelectorAll can run and the properties the rule sets.
export const collectHoverRules = (rules: Iterable<CSSRule>): HoverRule[] => {
  const hoverRules: HoverRule[] = [];

  walkStyleRules(rules, (selector, declarations) => {
    if (declarations.length === 0 || !selector.includes(HOVER_PSEUDO_CLASS)) return;
    // A list like `.a:hover, .b` would pin every `.b` on the page; only the
    // selectors that depend on hover matter. Pseudo-elements cannot be queried
    // or given inline styles, so those are left to drop with the hover.
    const hoverSelectors = splitSelectorList(selector).filter(
      (innerSelector) =>
        innerSelector.includes(HOVER_PSEUDO_CLASS) &&
        !innerSelector.includes(PSEUDO_ELEMENT_PREFIX),
    );
    if (hoverSelectors.length === 0) return;

    const propertyNames: string[] = [];
    for (let index = 0; index < declarations.length; index++) {
      propertyNames.push(declarations[index]);
    }
    hoverRules.push({ selector: hoverSelectors.join(", "), propertyNames });
  });

  return hoverRules;
};
