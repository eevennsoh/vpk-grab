import { describe, expect, it } from "vite-plus/test";
import { formatSpecToken } from "../src/utils/format-spec-token.js";

describe("formatSpecToken", () => {
  it("names a single token", () => {
    expect(formatSpecToken("var(--ds-radius-medium)", ["--ds-radius-medium"])).toBe(
      "--ds-radius-medium",
    );
  });

  it("keeps the step of a scaled spacing token", () => {
    expect(formatSpecToken("calc(var(--ds-space-050) * 3)", ["--ds-space-050"])).toBe(
      "--ds-space-050 × 3",
    );
    expect(formatSpecToken("calc(.5 * var(--ds-space-050))", ["--ds-space-050"])).toBe(
      "--ds-space-050 × 0.5",
    );
    expect(formatSpecToken("calc(var(--ds-space-050) * -2)", ["--ds-space-050"])).toBe(
      "--ds-space-050 × -2",
    );
  });

  it("lists each token of a compound value once", () => {
    expect(
      formatSpecToken("var(--tw-shadow), 0 0 0 1px var(--ds-border)", [
        "--ds-shadow-raised",
        "--ds-border",
        "--ds-border",
      ]),
    ).toBe("--ds-shadow-raised, --ds-border");
  });

  it("does not present plumbing as a scaled token", () => {
    expect(formatSpecToken("calc(var(--tw-space) * 2)", ["--ds-space-100"])).toBe("--ds-space-100");
  });
});
