import { describe, expect, it } from "vite-plus/test";
import { collectHoverRules } from "../src/utils/collect-hover-rules.js";

interface FakeRule {
  selectorText?: string;
  style?: string[];
  cssRules?: FakeRule[];
  styleSheet?: { cssRules: FakeRule[] };
  findRule?: () => null;
}

const styleRule = (selectorText: string, style: string[], cssRules: FakeRule[] = []): FakeRule => ({
  selectorText,
  style,
  cssRules,
});

const mediaRule = (cssRules: FakeRule[]): FakeRule => ({ cssRules });

const nestedDeclarations = (style: string[]): FakeRule => ({ style });

const collect = (rules: FakeRule[]) => collectHoverRules(rules as unknown as Iterable<CSSRule>);

describe("collectHoverRules", () => {
  it("finds elements revealed by an ancestor's hover", () => {
    expect(
      collect([styleRule(".card .more", ["opacity"]), styleRule(".card:hover .more", ["opacity"])]),
    ).toEqual([{ selector: ".card:hover .more", propertyNames: ["opacity"] }]);
  });

  it("keeps only the hover-dependent selectors of a list", () => {
    expect(collect([styleRule(".a:hover, .b, .c:hover > .d", ["color"])])).toEqual([
      { selector: ".a:hover, .c:hover > .d", propertyNames: ["color"] },
    ]);
  });

  it("does not split a selector list inside :is()", () => {
    expect(collect([styleRule(":is(.a, .b):hover .c", ["display"])])).toEqual([
      { selector: ":is(.a, .b):hover .c", propertyNames: ["display"] },
    ]);
  });

  it("resolves the nested group-hover shape Tailwind v4 emits", () => {
    const rules = [
      styleRule(
        ".group-hover\\:block",
        [],
        [
          styleRule(
            "&:is(:where(.group):hover *)",
            [],
            [mediaRule([nestedDeclarations(["display"])])],
          ),
        ],
      ),
    ];
    expect(collect(rules)).toEqual([
      {
        selector: ":is(.group-hover\\:block):is(:where(.group):hover *)",
        propertyNames: ["display"],
      },
    ]);
  });

  it("treats a nested selector without & as a descendant of its parent", () => {
    expect(
      collect([styleRule(".card:hover", ["color"], [styleRule(".more", ["opacity"])])]),
    ).toEqual([
      { selector: ".card:hover", propertyNames: ["color"] },
      { selector: ":is(.card:hover) .more", propertyNames: ["opacity"] },
    ]);
  });

  it("looks inside conditional rules and imported sheets", () => {
    expect(
      collect([
        mediaRule([styleRule(".a:hover", ["color"])]),
        { styleSheet: { cssRules: [styleRule(".b:hover", ["opacity"])] } },
      ]),
    ).toEqual([
      { selector: ".a:hover", propertyNames: ["color"] },
      { selector: ".b:hover", propertyNames: ["opacity"] },
    ]);
  });

  it("ignores pseudo-elements, which cannot be pinned", () => {
    expect(collect([styleRule(".a:hover::after", ["opacity"])])).toEqual([]);
  });

  it("does not read keyframes nested in a hover rule as its declarations", () => {
    const keyframesRule: FakeRule = {
      findRule: () => null,
      cssRules: [nestedDeclarations(["transform"])],
    };
    expect(collect([styleRule(".a:hover", ["color"], [keyframesRule])])).toEqual([
      { selector: ".a:hover", propertyNames: ["color"] },
    ]);
  });

  it("skips a nested sheet whose rules cannot be read", () => {
    const crossOriginImport: FakeRule = {
      styleSheet: {
        get cssRules(): FakeRule[] {
          throw new Error("SecurityError");
        },
      },
    };
    expect(collect([crossOriginImport, styleRule(".a:hover", ["color"])])).toEqual([
      { selector: ".a:hover", propertyNames: ["color"] },
    ]);
  });
});
