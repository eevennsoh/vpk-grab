import { describe, expect, it } from "vite-plus/test";
import { SPECS_BOX_SIDES } from "../src/constants.js";
import { getSpecShorthandProperty } from "../src/utils/get-spec-shorthand-property.js";

describe("getSpecShorthandProperty", () => {
  it("groups each side and corner under its shorthand", () => {
    for (const [property, sides] of Object.entries(SPECS_BOX_SIDES)) {
      expect(getSpecShorthandProperty(property)).toBe(property);
      for (const side of sides) expect(getSpecShorthandProperty(side.property)).toBe(property);
    }
  });

  it("leaves every other property alone", () => {
    for (const property of ["width", "height", "inset", "border-color", "padding-inline"]) {
      expect(getSpecShorthandProperty(property)).toBe(property);
    }
  });
});
