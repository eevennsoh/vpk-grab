import { SPECS_BOX_SIDES } from "../constants.js";

export const getSpecShorthandProperty = (property: string): string =>
  Object.entries(SPECS_BOX_SIDES).find(
    ([shorthand, sides]) =>
      shorthand === property || sides.some((side) => side.property === property),
  )?.[0] ?? property;
