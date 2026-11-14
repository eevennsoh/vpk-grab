import { SPECS_VALUE_MAX_LENGTH } from "../constants.js";
import { getElementAdapter } from "../core/element-adapter.js";
import type { ElementSpecRow, ElementSpecSection, ElementSpecs } from "../types.js";
import { collapseCssBoxSides } from "./collapse-css-box-sides.js";
import { getDefaultStylesForTag } from "./extract-element-css.js";
import { formatCssColor, isTransparentCssColor } from "./format-css-color.js";
import { formatCssNumber } from "./format-css-number.js";
import { getElementComputedStyle } from "./get-element-computed-style.js";
import { getSpecTokens } from "./get-spec-tokens.js";
import { getTagName } from "./get-tag-name.js";
import { mergeDisabledSpecRows } from "./merge-disabled-spec-rows.js";
import { getDisabledSpecRows } from "./spec-overrides.js";
import { truncateString } from "./truncate-string.js";

const BOX_SIDES = ["top", "right", "bottom", "left"] as const;
const BOX_CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;
const NEUTRAL_KEYWORDS = new Set(["auto", "none", "normal"]);
const NEUTRAL_TAG_NAME = "div";
const FLEX_DISPLAYS = new Set(["flex", "inline-flex"]);
const GRID_DISPLAYS = new Set(["grid", "inline-grid"]);
const TEXT_CONTROL_TAG_NAMES = new Set(["input", "textarea", "select", "button"]);
// Tailwind's rounded-full computes to calc(infinity * 1px), which the browser
// reports as an eight-digit pixel count.
const PILL_RADIUS_THRESHOLD_PX = 9999;

type ReadStyle = (propertyName: string) => string;

const createRow = (
  property: string,
  value: string,
  isApplied: boolean,
  swatchColor?: string,
): ElementSpecRow => ({
  property,
  value: truncateString(formatCssNumber(value), SPECS_VALUE_MAX_LENGTH),
  isApplied,
  swatchColor,
});

const isZeroLength = (value: string): boolean => Number.parseFloat(value) === 0;

const collapseSides = (values: string[]): string =>
  collapseCssBoxSides(values[0], values[1], values[2], values[3]);

// getComputedStyle resolves `auto` sizes and insets to used pixels, so only
// the typed OM (where the browser has it) can tell an authored width from one
// the layout produced.
const readSpecifiedValue = (element: Element, propertyName: string): string | null => {
  if (typeof element.computedStyleMap !== "function") return null;
  try {
    return element.computedStyleMap().get(propertyName)?.toString() ?? null;
  } catch {
    return null;
  }
};

const hasOwnText = (element: Element): boolean => {
  for (const childNode of element.childNodes) {
    if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.trim()) return true;
  }
  return false;
};

const formatFontFamily = (fontFamily: string): string =>
  fontFamily
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");

const formatCornerRadius = (radius: string): string =>
  Number.parseFloat(radius) >= PILL_RADIUS_THRESHOLD_PX ? `${PILL_RADIUS_THRESHOLD_PX}px` : radius;

const createAppearanceRows = (read: ReadStyle, isNonNeutral: (name: string) => boolean) => {
  const rows: ElementSpecRow[] = [];

  const backgroundColor = read("background-color");
  rows.push(
    createRow(
      "background-color",
      formatCssColor(backgroundColor),
      !isTransparentCssColor(backgroundColor),
      backgroundColor,
    ),
  );
  if (isNonNeutral("background-image")) {
    rows.push(createRow("background-image", read("background-image"), true));
  }

  const borderWidths = BOX_SIDES.map((side) => read(`border-${side}-width`));
  const borderedSides = BOX_SIDES.filter((_, index) => !isZeroLength(borderWidths[index]));
  const hasBorder = borderedSides.length > 0;
  // Sides without a border still compute a colour and style (currentcolor,
  // none); listing them next to the real ones would bury the answer.
  const readBorderedSides = (suffix: string): string[] =>
    (hasBorder ? borderedSides : BOX_SIDES).map((side) => read(`border-${side}-${suffix}`));
  const borderColors = readBorderedSides("color");
  const borderStyles = readBorderedSides("style");
  const isUniformBorderColor = borderColors.every((color) => color === borderColors[0]);
  const isUniformBorderStyle = borderStyles.every((style) => style === borderStyles[0]);

  rows.push(
    createRow(
      "border-color",
      isUniformBorderColor
        ? formatCssColor(borderColors[0])
        : borderColors.map(formatCssColor).join(" "),
      hasBorder,
      isUniformBorderColor ? borderColors[0] : undefined,
    ),
    createRow("border-width", collapseSides(borderWidths), hasBorder),
    createRow(
      "border-style",
      isUniformBorderStyle ? borderStyles[0] : borderStyles.join(" "),
      hasBorder,
    ),
  );

  const cornerRadii = BOX_CORNERS.map((corner) =>
    formatCornerRadius(read(`border-${corner}-radius`)),
  );
  rows.push(
    createRow(
      "border-radius",
      collapseSides(cornerRadii),
      cornerRadii.some((radius) => !isZeroLength(radius)),
    ),
    createRow("opacity", read("opacity"), read("opacity") !== "1"),
    createRow("box-shadow", read("box-shadow"), isNonNeutral("box-shadow")),
  );

  return rows;
};

const createSpacingRows = (read: ReadStyle, isLayoutContainer: boolean) => {
  const margins = BOX_SIDES.map((side) => read(`margin-${side}`));
  const paddings = BOX_SIDES.map((side) => read(`padding-${side}`));
  const rowGap = read("row-gap");
  const columnGap = read("column-gap");
  const hasGap = [rowGap, columnGap].some(
    (gap) => !NEUTRAL_KEYWORDS.has(gap) && !isZeroLength(gap),
  );

  return [
    createRow(
      "margin",
      collapseSides(margins),
      margins.some((margin) => !isZeroLength(margin)),
    ),
    createRow(
      "padding",
      collapseSides(paddings),
      paddings.some((padding) => !isZeroLength(padding)),
    ),
    createRow(
      "gap",
      rowGap === columnGap ? rowGap : `${rowGap} ${columnGap}`,
      isLayoutContainer && hasGap,
    ),
  ];
};

const createLayoutRows = (
  read: ReadStyle,
  isNonNeutral: (name: string) => boolean,
  tagName: string,
  parentDisplay: string | null,
) => {
  const display = read("display");
  const isFlex = FLEX_DISPLAYS.has(display);
  const isGrid = GRID_DISPLAYS.has(display);
  const rows: ElementSpecRow[] = [
    createRow("display", display, display !== getDefaultStylesForTag(tagName).get("display")),
  ];

  if (isFlex) {
    rows.push(
      createRow("flex-direction", read("flex-direction"), read("flex-direction") !== "row"),
      createRow("flex-wrap", read("flex-wrap"), read("flex-wrap") !== "nowrap"),
    );
  }
  if (isGrid) {
    rows.push(
      createRow(
        "grid-template-columns",
        read("grid-template-columns"),
        isNonNeutral("grid-template-columns"),
      ),
      createRow(
        "grid-template-rows",
        read("grid-template-rows"),
        isNonNeutral("grid-template-rows"),
      ),
    );
  }
  if (isFlex || isGrid) {
    rows.push(
      createRow("justify-content", read("justify-content"), isNonNeutral("justify-content")),
      createRow("align-items", read("align-items"), isNonNeutral("align-items")),
    );
  }

  const isLayoutItem =
    parentDisplay !== null &&
    (FLEX_DISPLAYS.has(parentDisplay) || GRID_DISPLAYS.has(parentDisplay));
  if (isLayoutItem) {
    for (const propertyName of ["align-self", "flex-grow", "flex-shrink", "flex-basis", "order"]) {
      if (isNonNeutral(propertyName)) rows.push(createRow(propertyName, read(propertyName), true));
    }
  }

  return rows;
};

const createSizeRows = (
  element: Element,
  read: ReadStyle,
  isNonNeutral: (name: string) => boolean,
) => {
  const rect = element.getBoundingClientRect();
  const createDimensionRow = (propertyName: "width" | "height"): ElementSpecRow => {
    const computedValue = read(propertyName);
    const specifiedValue = readSpecifiedValue(element, propertyName);
    const isAuthored = specifiedValue !== null && specifiedValue !== "auto";
    // An authored size reads as written (the content box, under content-box
    // sizing); a size the layout produced reads as the box that was rendered.
    return createRow(
      propertyName,
      isAuthored && computedValue.endsWith("px") ? computedValue : `${rect[propertyName]}px`,
      isAuthored,
    );
  };

  const rows: ElementSpecRow[] = [createDimensionRow("width"), createDimensionRow("height")];
  for (const propertyName of ["min-width", "max-width", "min-height", "max-height"]) {
    if (isNonNeutral(propertyName)) rows.push(createRow(propertyName, read(propertyName), true));
  }

  const position = read("position");
  rows.push(createRow("position", position, position !== "static"));
  if (position !== "static") {
    const insets = BOX_SIDES.map((side) => readSpecifiedValue(element, side) ?? read(side));
    if (insets.some((inset) => inset !== "auto")) {
      rows.push(createRow("inset", collapseSides(insets), true));
    }
  }
  if (isNonNeutral("z-index")) rows.push(createRow("z-index", read("z-index"), true));

  const overflowX = read("overflow-x");
  const overflowY = read("overflow-y");
  if (overflowX !== "visible" || overflowY !== "visible") {
    rows.push(
      createRow(
        "overflow",
        overflowX === overflowY ? overflowX : `${overflowX} ${overflowY}`,
        true,
      ),
    );
  }

  return rows;
};

const createTypographyRows = (
  read: ReadStyle,
  isNonNeutral: (name: string) => boolean,
  isSetOnElement: (name: string) => boolean,
) => {
  const color = read("color");
  const rows: ElementSpecRow[] = [
    createRow("font-family", formatFontFamily(read("font-family")), isSetOnElement("font-family")),
    createRow("font-size", read("font-size"), isSetOnElement("font-size")),
    createRow("font-weight", read("font-weight"), isSetOnElement("font-weight")),
    createRow("line-height", read("line-height"), isSetOnElement("line-height")),
    createRow("letter-spacing", read("letter-spacing"), isSetOnElement("letter-spacing")),
    createRow("color", formatCssColor(color), isSetOnElement("color"), color),
    createRow("text-align", read("text-align"), isSetOnElement("text-align")),
  ];
  for (const propertyName of ["text-transform", "text-decoration-line", "font-style"]) {
    if (isNonNeutral(propertyName)) {
      rows.push(createRow(propertyName, read(propertyName), isSetOnElement(propertyName)));
    }
  }
  return rows;
};

// A row is "applied" when the element shows something other than the neutral
// value: a non-transparent fill, a non-zero space, a display the tag does not
// have by default. Inherited text properties count only where this element
// changes what its parent hands down. Applied rows name the design tokens
// behind them, and rows switched off in the panel stay listed as disabled.
export const getElementSpecs = (element: Element): ElementSpecs | null => {
  if (getElementAdapter(element)) return null;

  const tagName = getTagName(element);
  const computedStyle = getElementComputedStyle(element);
  const parentElement = element.parentElement;
  const parentStyle = parentElement ? getElementComputedStyle(parentElement) : null;
  const neutralStyles = getDefaultStylesForTag(NEUTRAL_TAG_NAME);

  const read: ReadStyle = (propertyName) => computedStyle.getPropertyValue(propertyName);
  const isNonNeutral = (propertyName: string): boolean => {
    const value = read(propertyName);
    return (
      value !== "" && !NEUTRAL_KEYWORDS.has(value) && value !== neutralStyles.get(propertyName)
    );
  };
  const isSetOnElement = (propertyName: string): boolean =>
    parentStyle !== null && read(propertyName) !== parentStyle.getPropertyValue(propertyName);

  const display = read("display");
  const isLayoutContainer = FLEX_DISPLAYS.has(display) || GRID_DISPLAYS.has(display);

  const sections: ElementSpecSection[] = [
    { title: "Appearance", rows: createAppearanceRows(read, isNonNeutral) },
    { title: "Spacing", rows: createSpacingRows(read, isLayoutContainer) },
    {
      title: "Layout",
      rows: createLayoutRows(
        read,
        isNonNeutral,
        tagName,
        parentStyle?.getPropertyValue("display") ?? null,
      ),
    },
    { title: "Size & position", rows: createSizeRows(element, read, isNonNeutral) },
  ];

  const typographyRows = createTypographyRows(read, isNonNeutral, isSetOnElement);
  const isTextBearing = hasOwnText(element) || TEXT_CONTROL_TAG_NAMES.has(tagName);
  if (isTextBearing || typographyRows.some((row) => row.isApplied)) {
    sections.push({ title: "Typography", rows: typographyRows });
  }

  const appliedRows = sections.flatMap((section) => section.rows.filter((row) => row.isApplied));
  const tokensBySpecProperty = getSpecTokens(
    element,
    appliedRows.map((row) => row.property),
  );
  for (const row of appliedRows) row.tokens = tokensBySpecProperty.get(row.property);

  const rect = element.getBoundingClientRect();
  return {
    tagName,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
    sections: mergeDisabledSpecRows(sections, getDisabledSpecRows(element)),
  };
};
