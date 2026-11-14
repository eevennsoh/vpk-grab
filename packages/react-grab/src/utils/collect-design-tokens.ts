import { walkStyleRules } from "./walk-style-rules.js";

const CUSTOM_PROPERTY_PREFIX = "--";
const PLUMBING_VARIABLE_PREFIX = "--tw-";

// Every custom property a rule list defines, in the order first defined. A
// token set redefines its names per theme and per media query; the name is
// what is offered, and its value is read from the element it would apply to.
export const collectDesignTokens = (rules: Iterable<CSSRule>): string[] => {
  const tokenNames = new Set<string>();
  walkStyleRules(rules, (_selector, declarations) => {
    for (let index = 0; index < declarations.length; index++) {
      const property = declarations[index];
      if (
        property.startsWith(CUSTOM_PROPERTY_PREFIX) &&
        !property.startsWith(PLUMBING_VARIABLE_PREFIX)
      ) {
        tokenNames.add(property);
      }
    }
  });
  return [...tokenNames];
};
