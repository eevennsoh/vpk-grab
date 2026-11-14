import { describe, expect, it } from "vite-plus/test";
import { collectDesignTokens } from "../src/utils/collect-design-tokens.js";

interface FakeRule {
  selectorText?: string;
  style?: Record<number, string> & { length: number; cssText: string };
  cssRules?: FakeRule[];
}

const style = (properties: string[]) => ({
  ...Object.fromEntries(properties.map((property, index) => [index, property])),
  length: properties.length,
  cssText: "",
});

const styleRule = (selectorText: string, properties: string[]): FakeRule => ({
  selectorText,
  style: style(properties),
  cssRules: [],
});

const collect = (rules: FakeRule[]) => collectDesignTokens(rules as unknown as Iterable<CSSRule>);

describe("collectDesignTokens", () => {
  it("lists each custom property once, in the order first defined", () => {
    expect(
      collect([
        styleRule(":root", ["--ds-space-100", "--ds-text", "color"]),
        { cssRules: [styleRule("html[data-theme=dark]", ["--ds-text", "--ds-radius"])] },
      ]),
    ).toEqual(["--ds-space-100", "--ds-text", "--ds-radius"]);
  });

  it("leaves out Tailwind's plumbing variables", () => {
    expect(collect([styleRule(".shadow", ["--tw-shadow", "--brand"])])).toEqual(["--brand"]);
  });
});
