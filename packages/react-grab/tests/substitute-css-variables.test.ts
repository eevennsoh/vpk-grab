import { describe, expect, it } from "vite-plus/test";
import { substituteCssVariables } from "../src/utils/substitute-css-variables.js";

const VARIABLES: Record<string, string> = {
  "--space": "2px",
  "--brand": " #0c66e4 ",
  "--shadow": "0 1px 2px rgba(9, 30, 66, 0.25)",
};

const substitute = (value: string) =>
  substituteCssVariables(value, (variableName) => VARIABLES[variableName] ?? "");

describe("substituteCssVariables", () => {
  it("replaces a variable and reports its name", () => {
    expect(substitute("var(--brand)")).toEqual({ value: "#0c66e4", variableNames: ["--brand"] });
  });

  it("replaces variables inside other functions", () => {
    expect(substitute("calc(var(--space) * 3)")).toEqual({
      value: "calc(2px * 3)",
      variableNames: ["--space"],
    });
  });

  it("replaces every variable in a list, in order", () => {
    expect(substitute("var(--shadow), 0 0 var(--space) var(--brand)")).toEqual({
      value: "0 1px 2px rgba(9, 30, 66, 0.25), 0 0 2px #0c66e4",
      variableNames: ["--shadow", "--space", "--brand"],
    });
  });

  it("uses the fallback of an unset variable, and names only what supplied the value", () => {
    expect(substitute("var(--missing, 1.25rem)")).toEqual({ value: "1.25rem", variableNames: [] });
    expect(substitute("var(--missing, var(--space))")).toEqual({
      value: "2px",
      variableNames: ["--space"],
    });
  });

  it("ignores the fallback of a variable that is set", () => {
    expect(substitute("var(--space, var(--brand))")).toEqual({
      value: "2px",
      variableNames: ["--space"],
    });
  });

  it("keeps commas that belong to the fallback", () => {
    expect(substitute("var(--missing, rgb(1, 2, 3))")).toEqual({
      value: "rgb(1, 2, 3)",
      variableNames: [],
    });
  });

  it("is invalid when an unset variable has no fallback", () => {
    expect(substitute("calc(var(--missing) * 2)")).toBeNull();
    expect(substitute("var(--missing, var(--also-missing))")).toBeNull();
  });

  it("leaves a value without variables alone", () => {
    expect(substitute("1px solid red")).toEqual({ value: "1px solid red", variableNames: [] });
  });
});
