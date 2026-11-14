const VARIABLE = String.raw`var\(\s*(--[\w-]+)\s*\)`;
const FACTOR = String.raw`(-?\d*\.?\d+)`;
const SCALED_VARIABLE_PATTERN = new RegExp(
  String.raw`^calc\(\s*${VARIABLE}\s*\*\s*${FACTOR}\s*\)$`,
);
const VARIABLE_SCALED_PATTERN = new RegExp(
  String.raw`^calc\(\s*${FACTOR}\s*\*\s*${VARIABLE}\s*\)$`,
);

// Names the tokens behind an authored value. A spacing scale is written as a
// multiple of its base token (`calc(var(--space) * 3)`), and the multiple is
// what tells one step from another, so that shape keeps its factor.
export const formatSpecToken = (authoredValue: string, tokenNames: string[]): string => {
  const scaledMatch = SCALED_VARIABLE_PATTERN.exec(authoredValue);
  if (scaledMatch && tokenNames.includes(scaledMatch[1])) {
    return `${scaledMatch[1]} × ${Number(scaledMatch[2])}`;
  }
  const reversedMatch = VARIABLE_SCALED_PATTERN.exec(authoredValue);
  if (reversedMatch && tokenNames.includes(reversedMatch[2])) {
    return `${reversedMatch[2]} × ${Number(reversedMatch[1])}`;
  }
  return [...new Set(tokenNames)].join(", ");
};
