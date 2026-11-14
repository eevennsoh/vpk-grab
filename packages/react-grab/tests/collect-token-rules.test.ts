import { describe, expect, it } from "vite-plus/test";
import { collectTokenRules } from "../src/utils/collect-token-rules.js";

interface FakeRule {
  selectorText?: string;
  style?: { cssText: string };
  cssRules?: FakeRule[];
}

const styleRule = (selectorText: string, cssText: string, cssRules: FakeRule[] = []): FakeRule => ({
  selectorText,
  style: { cssText },
  cssRules,
});

const groupRule = (cssRules: FakeRule[]): FakeRule => ({ cssRules });

const nestedDeclarations = (cssText: string): FakeRule => ({ style: { cssText } });

const collect = (rules: FakeRule[]) => collectTokenRules(rules as unknown as Iterable<CSSRule>);

describe("collectTokenRules", () => {
  it("keeps only the declarations written with a custom property", () => {
    expect(
      collect([styleRule(".card", "display: flex; padding: calc(var(--space) * 3); gap: 4px;")]),
    ).toEqual([
      {
        selector: ".card",
        hoverlessSelector: null,
        declarations: [{ property: "padding", value: "calc(var(--space) * 3)" }],
      },
    ]);
  });

  it("skips rules that name no custom property", () => {
    expect(collect([styleRule(".card", "display: flex; gap: 4px;")])).toEqual([]);
  });

  it("walks into layers and media rules", () => {
    expect(
      collect([groupRule([groupRule([styleRule(".bg", "background-color: var(--brand);")])])]),
    ).toMatchObject([{ selector: ".bg" }]);
  });

  it("offers a selector with the hover already satisfied", () => {
    expect(collect([styleRule(".group:hover .action", "opacity: var(--shown);")])).toMatchObject([
      { selector: ".group:hover .action", hoverlessSelector: ".group:is(*) .action" },
    ]);
  });

  it("does not mistake an escaped class name for the pseudo-class", () => {
    expect(
      collect([styleRule(".md\\:hover\\:bg-brand:hover", "background-color: var(--brand);")]),
    ).toMatchObject([{ hoverlessSelector: ".md\\:hover\\:bg-brand:is(*)" }]);
  });

  it("attributes Tailwind's nested hover declarations to the hovered selector", () => {
    expect(
      collect([
        styleRule(".hover\\:bg-brand", "", [
          styleRule("&:hover", "", [
            groupRule([nestedDeclarations("background-color: var(--brand-hovered);")]),
          ]),
        ]),
      ]),
    ).toEqual([
      {
        selector: ":is(.hover\\:bg-brand):hover",
        hoverlessSelector: ":is(.hover\\:bg-brand):is(*)",
        declarations: [{ property: "background-color", value: "var(--brand-hovered)" }],
      },
    ]);
  });
});
