import { collectTokenRules } from "./collect-token-rules.js";
import { createSheetRuleCache } from "./create-sheet-rule-cache.js";
import { formatSpecToken } from "./format-spec-token.js";
import { getElementComputedStyle } from "./get-element-computed-style.js";
import { getPhysicalSpecProperty } from "./get-physical-spec-property.js";
import { getSpecShorthandProperty } from "./get-spec-shorthand-property.js";
import { getStyleProbe } from "./get-style-probe.js";
import { getElementStyleSheets } from "./get-element-style-sheets.js";
import { isSpecSourceProperty } from "./is-spec-source-property.js";
import { parseCssDeclarations, type CssDeclaration } from "./parse-css-declarations.js";
import { substituteCssVariables } from "./substitute-css-variables.js";

const VARIABLE_FUNCTION = "var(";
const CUSTOM_PROPERTY_PREFIX = "--";
// Tailwind composes utilities through its own `--tw-*` variables
// (`box-shadow: var(--tw-shadow)`); those are plumbing, and the token is
// whatever the plumbing was set to.
const PLUMBING_VARIABLE_PREFIX = "--tw-";
const PLUMBING_MAX_DEPTH = 4;
// What a value on the probe needs from the inspected element to compute the
// way it does there: `em` and `currentcolor` have something to resolve
// against, `light-dark()` picks the same side, logical sides map to the same
// physical ones, and a border width is not zeroed for want of a border style.
const PROBE_CONTEXT_PROPERTIES = [
  "color",
  "color-scheme",
  "font-size",
  "direction",
  "writing-mode",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
];

const getTokenRules = createSheetRuleCache(collectTokenRules);

const matchesSelector = (element: Element, selector: string): boolean => {
  try {
    return element.matches(selector);
  } catch {
    // A selector this engine cannot parse matches nothing here either.
    return false;
  }
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, "");

// Ordered nearest-to-winning first: the style attribute, then rules from the
// last in the document to the first, then rules that only match with a hover
// that is no longer real.
const collectTokenDeclarations = (element: Element): CssDeclaration[] => {
  const inlineDeclarations: CssDeclaration[] = [];
  const matchedDeclarations: CssDeclaration[] = [];
  const hoverDeclarations: CssDeclaration[] = [];

  const inlineCssText = element.getAttribute("style");
  if (inlineCssText?.includes(VARIABLE_FUNCTION)) {
    for (const declaration of parseCssDeclarations(inlineCssText)) {
      if (declaration.value.includes(VARIABLE_FUNCTION)) inlineDeclarations.push(declaration);
    }
  }

  for (const sheet of getElementStyleSheets(element)) {
    for (const tokenRule of getTokenRules(sheet) ?? []) {
      if (matchesSelector(element, tokenRule.selector)) {
        matchedDeclarations.push(...tokenRule.declarations);
      } else if (
        tokenRule.hoverlessSelector !== null &&
        matchesSelector(element, tokenRule.hoverlessSelector)
      ) {
        hoverDeclarations.push(...tokenRule.declarations);
      }
    }
  }

  return [...inlineDeclarations, ...matchedDeclarations.reverse(), ...hoverDeclarations.reverse()];
};

// The design tokens behind each of an element's specs: the custom properties
// its matching rules name for that property. Which matching rule actually won
// is not re-derived from the cascade (layers, specificity, media); instead a
// rule's value is applied to a probe and counts only where it computes to
// exactly what the element shows.
export const getSpecTokens = (
  element: Element,
  specProperties: string[],
): Map<string, string[]> => {
  const tokensBySpecProperty = new Map<string, string[]>();
  if (specProperties.length === 0) return tokensBySpecProperty;

  const declarations = collectTokenDeclarations(element);
  if (declarations.length === 0) return tokensBySpecProperty;
  const probe = getStyleProbe();
  if (!probe) return tokensBySpecProperty;

  const computedStyle = getElementComputedStyle(element);
  const probeComputedStyle = getComputedStyle(probe);
  const readVariable = (variableName: string): string =>
    computedStyle.getPropertyValue(variableName);
  const variableDeclarations = declarations.filter((declaration) =>
    declaration.property.startsWith(CUSTOM_PROPERTY_PREFIX),
  );

  const resolveTokenNames = (variableNames: string[], depth: number): string[] =>
    variableNames.flatMap((variableName) => {
      if (!variableName.startsWith(PLUMBING_VARIABLE_PREFIX)) return [variableName];
      if (depth >= PLUMBING_MAX_DEPTH) return [];
      const computedValue = normalizeWhitespace(readVariable(variableName));
      for (const declaration of variableDeclarations) {
        if (declaration.property !== variableName) continue;
        const substitution = substituteCssVariables(declaration.value, readVariable);
        if (substitution && normalizeWhitespace(substitution.value) === computedValue) {
          return resolveTokenNames(substitution.variableNames, depth + 1);
        }
      }
      return [];
    });

  for (const specProperty of specProperties) {
    const sourceProperty = getSpecShorthandProperty(specProperty);
    const claimedProperties = new Set<string>();
    const tokens: string[] = [];

    for (const declaration of declarations) {
      if (!isSpecSourceProperty(sourceProperty, declaration.property)) continue;
      const substitution = substituteCssVariables(declaration.value, readVariable);
      if (!substitution) continue;

      probe.style.cssText = "";
      probe.style.setProperty(declaration.property, substitution.value);
      const declaredProperties: string[] = [];
      for (let index = 0; index < probe.style.length; index++) {
        const declaredProperty = probe.style[index];
        if (
          isSpecSourceProperty(
            specProperty,
            sourceProperty === specProperty
              ? declaredProperty
              : getPhysicalSpecProperty(
                  declaredProperty,
                  computedStyle.writingMode,
                  computedStyle.direction,
                ),
          )
        ) {
          declaredProperties.push(declaredProperty);
        }
      }
      if (declaredProperties.length === 0) continue;

      for (const contextProperty of PROBE_CONTEXT_PROPERTIES) {
        if (probe.style.getPropertyValue(contextProperty)) continue;
        probe.style.setProperty(contextProperty, computedStyle.getPropertyValue(contextProperty));
      }
      if (!probe.style.getPropertyValue("display")) probe.style.setProperty("display", "none");

      const appliedProperties = declaredProperties.filter(
        (declaredProperty) =>
          !claimedProperties.has(declaredProperty) &&
          probeComputedStyle.getPropertyValue(declaredProperty) ===
            computedStyle.getPropertyValue(declaredProperty),
      );
      if (appliedProperties.length === 0) continue;
      for (const appliedProperty of appliedProperties) claimedProperties.add(appliedProperty);

      const tokenNames = resolveTokenNames(substitution.variableNames, 0);
      if (tokenNames.length === 0) continue;
      const token = formatSpecToken(declaration.value, tokenNames);
      if (!tokens.includes(token)) tokens.push(token);
    }

    if (tokens.length > 0) tokensBySpecProperty.set(specProperty, tokens);
  }

  probe.style.cssText = "display: none";
  return tokensBySpecProperty;
};
