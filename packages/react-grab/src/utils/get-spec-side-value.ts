import {
  SPECS_BOX_COMPONENT_INDEXES_BY_COUNT,
  SPECS_BOX_SIDES,
  SPECS_LOGICAL_SIDE_SUFFIXES,
  SPECS_RADIUS_MAX_AXES,
} from "../constants.js";
import { getPhysicalSpecProperty } from "./get-physical-spec-property.js";
import { getSpecShorthandProperty } from "./get-spec-shorthand-property.js";
import { splitCssBoxComponents } from "./split-css-box-components.js";
import { substituteCssVariables } from "./substitute-css-variables.js";

interface SpecSideValueOptions {
  property: string;
  value: string;
  specProperty: string;
  writingMode: string;
  direction: string;
  readVariable: (variableName: string) => string;
}

export const getSpecSideValue = (options: SpecSideValueOptions): string | null => {
  const shorthandProperty = getSpecShorthandProperty(options.specProperty);
  const sides = SPECS_BOX_SIDES[shorthandProperty];
  if (!sides || shorthandProperty === options.specProperty) return options.value;
  if (
    getPhysicalSpecProperty(options.property, options.writingMode, options.direction) ===
    options.specProperty
  ) {
    return options.value;
  }

  const properties =
    options.property === shorthandProperty
      ? sides.map((side) => side.property)
      : /^(?:(?:padding|margin)-(?:inline|block)|border-(?:inline|block)-width)$/.test(
            options.property,
          )
        ? SPECS_LOGICAL_SIDE_SUFFIXES.map((suffix) =>
            getPhysicalSpecProperty(
              options.property.replace(/(inline|block)/, `$1-${suffix}`),
              options.writingMode,
              options.direction,
            ),
          )
        : [];
  const sideIndex = properties.indexOf(options.specProperty);
  if (sideIndex < 0) return null;

  const halves = splitCssBoxComponents(options.value);
  if (
    !halves ||
    halves.length > (shorthandProperty === "border-radius" ? SPECS_RADIUS_MAX_AXES : 1)
  ) {
    return null;
  }

  const selectedComponents: string[] = [];
  for (const components of halves) {
    if (components.length > properties.length) return null;
    for (const component of components) {
      const substitution = substituteCssVariables(component, options.readVariable);
      const resolvedHalves = substitution ? splitCssBoxComponents(substitution.value) : null;
      if (!resolvedHalves || resolvedHalves.length !== 1 || resolvedHalves[0].length !== 1)
        return null;
    }
    const componentIndex = SPECS_BOX_COMPONENT_INDEXES_BY_COUNT[components.length]?.[sideIndex];
    if (componentIndex === undefined) return null;
    selectedComponents.push(components[componentIndex]);
  }
  return selectedComponents.join(" ");
};
