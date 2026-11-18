import { SPECS_VALUE_MAX_LENGTH } from "../constants.js";
import type { SpecValueOption } from "../types.js";
import { collectDesignTokens } from "./collect-design-tokens.js";
import { createSheetRuleCache } from "./create-sheet-rule-cache.js";
import { formatCssColor } from "./format-css-color.js";
import { formatCssNumber } from "./format-css-number.js";
import { getElementComputedStyle } from "./get-element-computed-style.js";
import { getElementStyleSheets } from "./get-element-style-sheets.js";
import { getSpecShorthandProperty } from "./get-spec-shorthand-property.js";
import { getSpecKeywordOptions } from "./spec-keyword-options.js";
import { getStyleProbe } from "./get-style-probe.js";
import { truncateString } from "./truncate-string.js";

const COLOR_PROPERTIES = new Set(["background-color", "border-color", "color"]);

// Words a token name carries when it was made for a property. Matching tokens
// are listed first; for properties whose grammar takes almost any number or
// identifier, they are the only tokens listed, or every numeric token on the
// page would be offered as a font weight.
const NAME_HINTS_BY_PROPERTY: Record<string, string[]> = {
  padding: ["space", "spacing", "gap"],
  margin: ["space", "spacing", "gap"],
  gap: ["space", "spacing", "gap"],
  inset: ["space", "spacing", "inset"],
  "border-radius": ["radius", "rounded", "corner"],
  "border-width": ["border-width", "border"],
  "background-color": ["background", "bg", "surface", "fill"],
  "border-color": ["border", "outline"],
  color: ["text", "color", "foreground", "fg", "icon", "link"],
  "box-shadow": ["shadow", "elevation"],
  "font-size": ["font-size", "text", "size"],
  "font-family": ["font-family", "font"],
  "font-weight": ["font-weight", "weight"],
  "line-height": ["line-height", "leading"],
  "letter-spacing": ["letter-spacing", "tracking"],
  opacity: ["opacity"],
  "z-index": ["z-index", "layer"],
  width: ["size", "width", "space"],
  height: ["size", "height", "space"],
  "min-width": ["size", "width"],
  "max-width": ["size", "width"],
  "min-height": ["size", "height"],
  "max-height": ["size", "height"],
};

const NAME_HINT_REQUIRED_PROPERTIES = new Set([
  "font-family",
  "font-weight",
  "line-height",
  "opacity",
  "z-index",
  "order",
  "flex-grow",
  "flex-shrink",
]);

const getDesignTokens = createSheetRuleCache(collectDesignTokens);

const getPageTokenNames = (element: Element): string[] => {
  const tokenNames = new Set<string>();
  for (const sheet of getElementStyleSheets(element)) {
    for (const tokenName of getDesignTokens(sheet) ?? []) tokenNames.add(tokenName);
  }
  return [...tokenNames];
};

const matchesNameHint = (tokenName: string, nameHints: string[]): boolean =>
  nameHints.some((nameHint) => tokenName.includes(nameHint));

const formatResolvedValue = (property: string, computedValue: string): string =>
  truncateString(
    COLOR_PROPERTIES.has(property) ? formatCssColor(computedValue) : formatCssNumber(computedValue),
    SPECS_VALUE_MAX_LENGTH,
  );

// Every token on the page whose value the property would take, each with what
// it computes to on this element (a rem as px, a colour as hex), then the
// keywords the property takes.
export const getSpecValueOptions = (element: Element, property: string): SpecValueOption[] => {
  const computedStyle = getElementComputedStyle(element);
  const nameHints = NAME_HINTS_BY_PROPERTY[getSpecShorthandProperty(property)] ?? [];
  const isNameHintRequired = NAME_HINT_REQUIRED_PROPERTIES.has(property);
  const probe = getStyleProbe();
  const probeComputedStyle = probe ? getComputedStyle(probe) : null;
  if (probe) {
    probe.style.cssText = "display: none";
    probe.style.setProperty("font-size", computedStyle.getPropertyValue("font-size"));
    probe.style.setProperty("color", computedStyle.getPropertyValue("color"));
  }

  const hintedOptions: SpecValueOption[] = [];
  const otherOptions: SpecValueOption[] = [];
  for (const tokenName of getPageTokenNames(element)) {
    const tokenValue = computedStyle.getPropertyValue(tokenName).trim();
    if (!tokenValue || !CSS.supports(property, tokenValue)) continue;
    const isHinted = matchesNameHint(tokenName, nameHints);
    if (isNameHintRequired && !isHinted) continue;

    let computedValue = tokenValue;
    if (probe && probeComputedStyle) {
      probe.style.setProperty(property, tokenValue);
      computedValue = probeComputedStyle.getPropertyValue(property) || tokenValue;
    }
    const option: SpecValueOption = {
      kind: "token",
      label: tokenName,
      value: `var(${tokenName})`,
      resolvedValue: formatResolvedValue(property, computedValue),
      swatchColor: COLOR_PROPERTIES.has(property) ? computedValue : undefined,
    };
    (isHinted ? hintedOptions : otherOptions).push(option);
  }
  if (probe) probe.style.cssText = "display: none";

  const keywordOptions = getSpecKeywordOptions(property).map(
    (keyword): SpecValueOption => ({
      kind: "keyword",
      label: keyword,
      value: keyword,
      resolvedValue: "",
    }),
  );
  return [...hintedOptions, ...otherOptions, ...keywordOptions];
};
