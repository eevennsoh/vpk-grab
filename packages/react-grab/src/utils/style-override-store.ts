import type { ElementSpecRow, StyleOverride } from "../types.js";

interface InlineStyleProperty {
  value: string;
  priority: string;
}

interface StoredStyleOverride extends StyleOverride {
  previousInlineProperties: Map<string, InlineStyleProperty>;
  appliedInlineValues: Map<string, string>;
}

type StyledElement = Element & ElementCSSInlineStyle;

// `unset` drops a property to what it would be with nothing setting it. For
// display that is `inline`, which rearranges the page around the element
// rather than showing it without the rule, so display falls back to the tag's
// own default instead.
const OFF_VALUE = "unset";
const OFF_VALUE_BY_PROPERTY: Record<string, string> = { display: "revert" };
const IMPORTANT_PRIORITY = "important";

const overridesByElement = new Map<Element, Map<string, StoredStyleOverride>>();
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

// A shorthand set to a value with var() in it leaves its longhands empty in
// the style attribute until computed, so the shorthand itself is read too.
const readInlineValues = (element: StyledElement, override: StoredStyleOverride) => {
  const inlineValues = new Map<string, string>();
  inlineValues.set(override.property, element.style.getPropertyValue(override.property));
  for (const longhand of override.previousInlineProperties.keys()) {
    inlineValues.set(longhand, element.style.getPropertyValue(longhand));
  }
  return inlineValues;
};

// Something else may rewrite the style attribute after an override is set
// (the app re-rendering, or the hover pins being lifted on deactivate). An
// override that is no longer in place is forgotten rather than reported.
const isOverrideInPlace = (element: StyledElement, override: StoredStyleOverride): boolean => {
  if (!element.isConnected) return false;
  for (const [property, appliedValue] of override.appliedInlineValues) {
    if (element.style.getPropertyValue(property) !== appliedValue) return false;
  }
  return element.style.getPropertyPriority(override.property) === IMPORTANT_PRIORITY;
};

const restoreInlineProperties = (element: StyledElement, override: StoredStyleOverride) => {
  for (const [longhand, previous] of override.previousInlineProperties) {
    if (previous.value) element.style.setProperty(longhand, previous.value, previous.priority);
    else element.style.removeProperty(longhand);
  }
};

const writeOverride = (element: StyledElement, override: StoredStyleOverride) => {
  if (override.isOff) {
    const offValue = OFF_VALUE_BY_PROPERTY[override.property] ?? OFF_VALUE;
    for (const longhand of override.previousInlineProperties.keys()) {
      element.style.setProperty(longhand, offValue, IMPORTANT_PRIORITY);
    }
  } else if (override.value !== null) {
    element.style.setProperty(override.property, override.value, IMPORTANT_PRIORITY);
  } else {
    restoreInlineProperties(element, override);
  }
  override.appliedInlineValues = readInlineValues(element, override);
};

const getLiveOverrides = (element: Element): Map<string, StoredStyleOverride> | null => {
  const overrides = overridesByElement.get(element);
  if (!overrides) return null;
  if (!isStyledElement(element)) {
    overridesByElement.delete(element);
    return null;
  }
  for (const [property, override] of overrides) {
    if (!isOverrideInPlace(element, override)) overrides.delete(property);
  }
  if (overrides.size === 0) {
    overridesByElement.delete(element);
    return null;
  }
  return overrides;
};

const getOrCreateOverride = (
  element: StyledElement,
  row: ElementSpecRow,
): StoredStyleOverride | null => {
  const existingOverride = getLiveOverrides(element)?.get(row.property);
  if (existingOverride) return existingOverride;

  const longhands = getLonghands(element, row.property);
  if (longhands.length === 0) return null;
  const previousInlineProperties = new Map<string, InlineStyleProperty>();
  for (const longhand of longhands) {
    previousInlineProperties.set(longhand, {
      value: element.style.getPropertyValue(longhand),
      priority: element.style.getPropertyPriority(longhand),
    });
  }
  const { override: _previousOverride, ...original } = row;
  return {
    element,
    property: row.property,
    original,
    isOff: false,
    value: null,
    token: null,
    previousInlineProperties,
    appliedInlineValues: new Map(),
  };
};

const saveOverride = (element: StyledElement, override: StoredStyleOverride) => {
  if (!override.isOff && override.value === null) {
    resetStyleOverride(element, override.property);
    return;
  }
  writeOverride(element, override);
  let overrides = overridesByElement.get(element);
  if (!overrides) {
    overrides = new Map();
    overridesByElement.set(element, overrides);
  }
  overrides.set(override.property, override);
};

const toPublicOverride = (override: StoredStyleOverride): StyleOverride => ({
  element: override.element,
  property: override.property,
  original: override.original,
  isOff: override.isOff,
  value: override.value,
  token: override.token,
});

export const canOverrideStyles = (element: Element): boolean => isStyledElement(element);

export const isValidStyleValue = (property: string, value: string): boolean =>
  value.trim() !== "" && CSS.supports(property, value);

export const getElementStyleOverrides = (element: Element): Map<string, StyleOverride> => {
  const publicOverrides = new Map<string, StyleOverride>();
  for (const [property, override] of getLiveOverrides(element) ?? []) {
    publicOverrides.set(property, toPublicOverride(override));
  }
  return publicOverrides;
};

export const getAllStyleOverrides = (): StyleOverride[] => {
  const allOverrides: StyleOverride[] = [];
  for (const element of [...overridesByElement.keys()]) {
    for (const override of getLiveOverrides(element)?.values() ?? []) {
      allOverrides.push(toPublicOverride(override));
    }
  }
  return allOverrides;
};

export const setStyleOverrideOff = (element: Element, row: ElementSpecRow, isOff: boolean) => {
  if (!isStyledElement(element)) return;
  const override = getOrCreateOverride(element, row);
  if (!override) return;
  override.isOff = isOff;
  saveOverride(element, override);
};

export const setStyleOverrideValue = (
  element: Element,
  row: ElementSpecRow,
  value: string,
  token: string | null,
): boolean => {
  const trimmedValue = value.trim();
  if (!isStyledElement(element) || !isValidStyleValue(row.property, trimmedValue)) return false;
  const override = getOrCreateOverride(element, row);
  if (!override) return false;
  override.isOff = false;
  override.value = trimmedValue;
  override.token = token;
  saveOverride(element, override);
  return true;
};

export const resetStyleOverride = (element: Element, property: string) => {
  const overrides = overridesByElement.get(element);
  const override = overrides?.get(property);
  if (!overrides || !override || !isStyledElement(element)) return;
  const isInPlace = isOverrideInPlace(element, override);
  overrides.delete(property);
  if (overrides.size === 0) overridesByElement.delete(element);
  if (isInPlace) restoreInlineProperties(element, override);
};

export const resetElementStyleOverrides = (element: Element) => {
  for (const property of [...(overridesByElement.get(element)?.keys() ?? [])]) {
    resetStyleOverride(element, property);
  }
};

export const resetAllStyleOverrides = () => {
  for (const element of [...overridesByElement.keys()]) resetElementStyleOverrides(element);
};
