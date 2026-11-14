import { splitSelectorList } from "./split-selector-list.js";

export type StyleRuleVisitor = (selector: string, declarations: CSSStyleDeclaration) => void;

const NESTING_SELECTOR = "&";

const resolveNestedSelector = (selectorText: string, parentSelector: string | null): string => {
  if (parentSelector === null) return selectorText;
  const parentReference = `:is(${parentSelector})`;
  return splitSelectorList(selectorText)
    .map((innerSelector) =>
      innerSelector.includes(NESTING_SELECTOR)
        ? innerSelector.replaceAll(NESTING_SELECTOR, parentReference)
        : `${parentReference} ${innerSelector}`,
    )
    .join(", ");
};

export const readCssRules = (container: { cssRules: CSSRuleList }): CSSRuleList | null => {
  try {
    return container.cssRules;
  } catch {
    // Cross-origin stylesheets throw on cssRules access.
    return null;
  }
};

// Duck-typed rather than `instanceof`: rules from a same-origin iframe belong
// to that frame's realm, so its CSSStyleRule is not this window's.
const walkRules = (
  rules: Iterable<CSSRule>,
  parentSelector: string | null,
  visit: StyleRuleVisitor,
): void => {
  for (const rule of rules) {
    // @keyframes: its keyframe rules carry declarations but no selector, and
    // must not be read as nested declarations of an enclosing style rule.
    if ("findRule" in rule) continue;

    if ("selectorText" in rule && "style" in rule) {
      const styleRule = rule as CSSStyleRule;
      const selector = resolveNestedSelector(styleRule.selectorText, parentSelector);
      visit(selector, styleRule.style);
      if (styleRule.cssRules?.length) walkRules(styleRule.cssRules, selector, visit);
      continue;
    }

    // Declarations sitting directly inside a conditional rule that is itself
    // nested in a style rule (`.a { &:hover { @media (hover: hover) { … } } }`,
    // the shape Tailwind v4 emits) belong to the enclosing selector.
    if ("style" in rule && parentSelector !== null) {
      visit(parentSelector, (rule as CSSStyleRule).style);
      continue;
    }

    if ("styleSheet" in rule) {
      const importedSheet = (rule as CSSImportRule).styleSheet;
      const importedRules = importedSheet ? readCssRules(importedSheet) : null;
      if (importedRules) walkRules(importedRules, parentSelector, visit);
      continue;
    }

    if ("cssRules" in rule) {
      const nestedRules = readCssRules(rule as CSSGroupingRule);
      if (nestedRules) walkRules(nestedRules, parentSelector, visit);
    }
  }
};

// Visits every set of declarations in a rule list with the selector it applies
// to, nesting flattened into a selector `matches` and `querySelectorAll` can
// run. Conditional rules (@media, @supports, @layer) are walked through
// whether or not they currently apply.
export const walkStyleRules = (rules: Iterable<CSSRule>, visit: StyleRuleVisitor): void =>
  walkRules(rules, null, visit);
