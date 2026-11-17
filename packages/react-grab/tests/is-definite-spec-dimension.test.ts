import { describe, expect, it } from "vite-plus/test";
import { isDefiniteSpecDimension } from "../src/utils/is-definite-spec-dimension.js";

describe("isDefiniteSpecDimension", () => {
  it("accepts computed numeric lengths, percentages and math expressions", () => {
    for (const value of [
      "200px",
      "50%",
      "10rem",
      ".5px",
      "calc(50% - 2px)",
      "min(20px, 30%)",
      "max(20px, 30%)",
      "clamp(1px, 20%, 30px)",
    ]) {
      expect(isDefiniteSpecDimension(value)).toBe(true);
    }
  });

  it("rejects intrinsic and CSS-wide keywords and unresolved variables", () => {
    for (const value of [
      "auto",
      "min-content",
      "max-content",
      "fit-content",
      "inherit",
      "initial",
      "unset",
      "var(--unresolved)",
      "",
    ]) {
      expect(isDefiniteSpecDimension(value)).toBe(false);
    }
  });
});
