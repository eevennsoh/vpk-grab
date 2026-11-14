import { describe, expect, it } from "vite-plus/test";
import { parseCssDeclarations } from "../src/utils/parse-css-declarations.js";

describe("parseCssDeclarations", () => {
  it("reads declarations as authored, shorthands included", () => {
    expect(parseCssDeclarations("padding: calc(var(--space) * 3); color: var(--text);")).toEqual([
      { property: "padding", value: "calc(var(--space) * 3)" },
      { property: "color", value: "var(--text)" },
    ]);
  });

  it("drops the !important flag from the value", () => {
    expect(parseCssDeclarations("opacity: 1 !important; color: red!important")).toEqual([
      { property: "opacity", value: "1" },
      { property: "color", value: "red" },
    ]);
  });

  it("does not split on semicolons or colons inside functions and strings", () => {
    expect(
      parseCssDeclarations(
        `background-image: url("data:image/svg+xml;utf8,<svg/>"); content: "a;b"; --x: var(--y, 1px)`,
      ),
    ).toEqual([
      { property: "background-image", value: `url("data:image/svg+xml;utf8,<svg/>")` },
      { property: "content", value: `"a;b"` },
      { property: "--x", value: "var(--y, 1px)" },
    ]);
  });

  it("skips empty and malformed declarations", () => {
    expect(parseCssDeclarations(" ; color ; margin: ; gap: 4px ;")).toEqual([
      { property: "gap", value: "4px" },
    ]);
  });
});
