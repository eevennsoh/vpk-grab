import type { DisabledSpecRow } from "../types.js";

interface InlineStyleProperty {
  value: string;
  priority: string;
}

interface SpecOverride extends DisabledSpecRow {
  offValue: string;
  previousInlineProperties: Map<string, InlineStyleProperty>;
}

type StyledElement = Element & ElementCSSInlineStyle;

// `unset` drops a property to what it would be with nothing setting it. For
// display that is `inline`, which rearranges the page around the element
// rather than showing it without the rule, so display falls back to the tag's
// own default instead.
const OFF_VALUE = "unset";
const OFF_VALUE_BY_PROPERTY: Record<string, string> = { display: "revert" };
const IMPORTANT_PRIORITY = "important";

const overridesByElement = new WeakMap<Element, Map<string, SpecOverride>>();
const longhandsByProperty = new Map<string, string[]>();

const isStyledElement = (element: Element): element is StyledElement =>
  "style" in element && typeof element.style === "object" && element.style !== null;

// A spec such as `padding` or `inset` is a shorthand; the style attribute
// holds its longhands, and those are what get saved and put back.
const getLonghands = (element: Element, property: string): string[] => {
  const cachedLonghands = longhandsByProperty.get(property);
  if (cachedLonghands) return cachedLonghands;

  const scratchStyle = element.ownerDocument.createElement("div").style;
  scratchStyle.setProperty(property, OFF_VALUE);
  const longhands: string[] = [];
  for (let index = 0; index < scratchStyle.length; index++) longhands.push(scratchStyle[index]);
  longhandsByProperty.set(property, longhands);
  return longhands;
};

// Something else may rewrite the style attribute after a spec is switched off
// (the app re-rendering, or the hover pins being lifted on deactivate). An
// override that is no longer in place is forgotten rather than reported.
const isOverrideInPlace = (element: StyledElement, override: SpecOverride): boolean =>
  [...override.previousInlineProperties.keys()].every(
    (longhand) =>
      element.style.getPropertyValue(longhand) === override.offValue &&
      element.style.getPropertyPriority(longhand) === IMPORTANT_PRIORITY,
  );

export const canOverrideSpecs = (element: Element): boolean => isStyledElement(element);

export const getDisabledSpecRows = (element: Element): DisabledSpecRow[] => {
  const overrides = overridesByElement.get(element);
  if (!overrides || !isStyledElement(element)) return [];

  const disabledRows: DisabledSpecRow[] = [];
  for (const [property, override] of overrides) {
    if (isOverrideInPlace(element, override)) disabledRows.push(override);
    else overrides.delete(property);
  }
  return disabledRows;
};

export const disableSpec = (element: Element, disabledRow: DisabledSpecRow): void => {
  if (!isStyledElement(element)) return;
  const property = disabledRow.row.property;
  if (overridesByElement.get(element)?.has(property)) return;
  const longhands = getLonghands(element, property);
  if (longhands.length === 0) return;

  const offValue = OFF_VALUE_BY_PROPERTY[property] ?? OFF_VALUE;
  const previousInlineProperties = new Map<string, InlineStyleProperty>();
  for (const longhand of longhands) {
    previousInlineProperties.set(longhand, {
      value: element.style.getPropertyValue(longhand),
      priority: element.style.getPropertyPriority(longhand),
    });
    element.style.setProperty(longhand, offValue, IMPORTANT_PRIORITY);
  }

  let overrides = overridesByElement.get(element);
  if (!overrides) {
    overrides = new Map();
    overridesByElement.set(element, overrides);
  }
  overrides.set(property, { ...disabledRow, offValue, previousInlineProperties });
};

export const enableSpec = (element: Element, property: string): void => {
  const overrides = overridesByElement.get(element);
  const override = overrides?.get(property);
  if (!overrides || !override || !isStyledElement(element)) return;
  overrides.delete(property);
  if (!isOverrideInPlace(element, override)) return;

  for (const [longhand, previous] of override.previousInlineProperties) {
    if (previous.value) element.style.setProperty(longhand, previous.value, previous.priority);
    else element.style.removeProperty(longhand);
  }
};

export const enableAllSpecs = (element: Element): void => {
  const overrides = overridesByElement.get(element);
  if (!overrides) return;
  for (const property of [...overrides.keys()]) enableSpec(element, property);
};
