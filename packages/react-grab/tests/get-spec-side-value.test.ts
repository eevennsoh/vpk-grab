import { describe, expect, it } from "vite-plus/test";
import { getSpecSideValue } from "../src/utils/get-spec-side-value.js";

const VARIABLE_VALUES: Record<string, string> = {
  "--a": "2px",
  "--b": "4px",
  "--c": "6px",
  "--d": "8px",
  "--multiple": "2px 4px",
  "--ellipse": "2px / 4px",
};
const PADDING_PROPERTIES = ["padding-top", "padding-right", "padding-bottom", "padding-left"];
const CORNER_PROPERTIES = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
];

const selectSide = (
  value: string,
  specProperty = "padding-top",
  property = "padding",
  writingMode = "horizontal-tb",
  direction = "ltr",
) =>
  getSpecSideValue({
    value,
    property,
    specProperty,
    writingMode,
    direction,
    readVariable: (variableName) => VARIABLE_VALUES[variableName] ?? "",
  });

describe("getSpecSideValue", () => {
  it.each([
    { value: "var(--a)", expected: ["var(--a)", "var(--a)", "var(--a)", "var(--a)"] },
    {
      value: "var(--a) var(--b)",
      expected: ["var(--a)", "var(--b)", "var(--a)", "var(--b)"],
    },
    {
      value: "var(--a) var(--b) var(--c)",
      expected: ["var(--a)", "var(--b)", "var(--c)", "var(--b)"],
    },
    {
      value: "var(--a) var(--b) var(--c) var(--d)",
      expected: ["var(--a)", "var(--b)", "var(--c)", "var(--d)"],
    },
  ])("expands box components in $value", ({ value, expected }) => {
    for (const property of ["padding", "margin", "border-width"]) {
      const properties = PADDING_PROPERTIES.map((sideProperty) =>
        property === "border-width"
          ? sideProperty.replace("padding", "border") + "-width"
          : sideProperty.replace("padding", property),
      );
      expect(properties.map((specProperty) => selectSide(value, specProperty, property))).toEqual(
        expected,
      );
    }
  });

  it.each([
    { direction: "ltr", start: "left", end: "right" },
    { direction: "rtl", start: "right", end: "left" },
  ])("maps inline start and end in horizontal $direction", ({ direction, start, end }) => {
    for (const property of ["padding", "margin", "border"]) {
      const suffix = property === "border" ? "-width" : "";
      const shorthand = `${property}-inline${suffix}`;
      expect(
        selectSide(
          "var(--a) var(--b)",
          `${property}-${start}${suffix}`,
          shorthand,
          "horizontal-tb",
          direction,
        ),
      ).toBe("var(--a)");
      expect(
        selectSide(
          "var(--a) var(--b)",
          `${property}-${end}${suffix}`,
          shorthand,
          "horizontal-tb",
          direction,
        ),
      ).toBe("var(--b)");
      expect(
        selectSide(
          "var(--a)",
          `${property}-${end}${suffix}`,
          shorthand,
          "horizontal-tb",
          direction,
        ),
      ).toBe("var(--a)");
    }
  });

  it.each([
    { writingMode: "horizontal-tb", direction: "ltr", axis: "block", start: "top", end: "bottom" },
    { writingMode: "horizontal-tb", direction: "rtl", axis: "block", start: "top", end: "bottom" },
    { writingMode: "vertical-rl", direction: "ltr", axis: "inline", start: "top", end: "bottom" },
    { writingMode: "vertical-rl", direction: "rtl", axis: "inline", start: "bottom", end: "top" },
    { writingMode: "vertical-rl", direction: "ltr", axis: "block", start: "right", end: "left" },
    { writingMode: "vertical-lr", direction: "rtl", axis: "block", start: "left", end: "right" },
    { writingMode: "sideways-lr", direction: "ltr", axis: "inline", start: "bottom", end: "top" },
  ])(
    "maps $axis components in $writingMode $direction",
    ({ writingMode, direction, axis, start, end }) => {
      expect(
        selectSide(
          "var(--a) var(--b)",
          `padding-${start}`,
          `padding-${axis}`,
          writingMode,
          direction,
        ),
      ).toBe("var(--a)");
      expect(
        selectSide(
          "var(--a) var(--b)",
          `padding-${end}`,
          `padding-${axis}`,
          writingMode,
          direction,
        ),
      ).toBe("var(--b)");
    },
  );

  it.each([
    { value: "var(--a)", expected: ["var(--a)", "var(--a)", "var(--a)", "var(--a)"] },
    { value: "var(--a) var(--b)", expected: ["var(--a)", "var(--b)", "var(--a)", "var(--b)"] },
    {
      value: "var(--a) var(--b) var(--c)",
      expected: ["var(--a)", "var(--b)", "var(--c)", "var(--b)"],
    },
    {
      value: "var(--a) var(--b) var(--c) var(--d)",
      expected: ["var(--a)", "var(--b)", "var(--c)", "var(--d)"],
    },
    {
      value: "var(--a)/var(--b)",
      expected: [
        "var(--a) var(--b)",
        "var(--a) var(--b)",
        "var(--a) var(--b)",
        "var(--a) var(--b)",
      ],
    },
    {
      value: "var(--a) var(--b) var(--c) var(--d) / 10px 20px 30px",
      expected: ["var(--a) 10px", "var(--b) 20px", "var(--c) 30px", "var(--d) 20px"],
    },
    {
      value: "var(--a) var(--b) / 10px 20px 30px 40px",
      expected: ["var(--a) 10px", "var(--b) 20px", "var(--a) 30px", "var(--b) 40px"],
    },
  ])("selects corner components in $value", ({ value, expected }) => {
    expect(
      CORNER_PROPERTIES.map((property) => selectSide(value, property, "border-radius")),
    ).toEqual(expected);
  });

  it("keeps functions, fallback whitespace, and nested parentheses intact", () => {
    const components = [
      "calc(var(--a) * 2)",
      "var(--missing, 4px)",
      "max(var(--a), var(--b))",
      "calc(max(var(--c), var(--d)) + 1px)",
    ];
    const value = ` \t${components.join("\n\t")} `;
    expect(PADDING_PROPERTIES.map((property) => selectSide(value, property))).toEqual(components);
    expect(selectSide("var(--missing, var(--a)) var(--b)")).toBe("var(--missing, var(--a))");
    expect(
      selectSide(
        "calc(var(--a) / 2) / max(var(--b), 3px)",
        "border-top-left-radius",
        "border-radius",
      ),
    ).toBe("calc(var(--a) / 2) max(var(--b), 3px)");
  });

  it.each([
    "",
    "   ",
    "var(--multiple)",
    "var(--multiple) var(--b)",
    "var(--missing, 2px 4px)",
    "var(--multiple) var(--missing,)",
    "var(--missing)",
    "var(--missing,)",
    "var(--ellipse)",
    "var(--a) var(--b) var(--c) var(--d) 10px",
    "calc(var(--a) * 2",
    "var(--a)) var(--b)",
    "var(--a), var(--b)",
    "var(--a); var(--b)",
    "var(--a) / var(--b)",
    "[var(--a)] var(--b)",
  ])("declines an indeterminate or unexpected box value: %s", (value) => {
    expect(selectSide(value)).toBeNull();
  });

  it.each([
    "var(--a) /",
    "/ var(--a)",
    "var(--a) // var(--b)",
    "var(--a) / var(--b) / var(--c)",
    "var(--a) / var(--multiple)",
    "var(--multiple) / var(--a)",
    "var(--a) / var(--b) 2px 4px 6px 8px",
  ])("declines an indeterminate or unexpected radius: %s", (value) => {
    expect(selectSide(value, "border-top-left-radius", "border-radius")).toBeNull();
  });

  it("declines axis values with too many components or an unrelated side", () => {
    expect(selectSide("var(--a) var(--b) var(--c)", "padding-left", "padding-inline")).toBeNull();
    expect(selectSide("var(--multiple)", "padding-left", "padding-inline")).toBeNull();
    expect(selectSide("var(--a) var(--b)", "padding-top", "padding-inline")).toBeNull();
    expect(selectSide("solid var(--a) var(--b)", "border-top-width", "border")).toBeNull();
  });

  it("preserves shorthand rows, physical and logical longhands, and unrelated properties", () => {
    expect(selectSide("var(--multiple)", "padding")).toBe("var(--multiple)");
    expect(selectSide("var(--a)", "padding-top", "padding-top")).toBe("var(--a)");
    expect(selectSide("var(--a)", "padding-left", "padding-inline-start")).toBe("var(--a)");
    expect(
      selectSide("var(--multiple)", "border-top-left-radius", "border-start-start-radius"),
    ).toBe("var(--multiple)");
    expect(selectSide("var(--a) var(--b)", "gap", "gap")).toBe("var(--a) var(--b)");
  });
});
