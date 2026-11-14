// Splits on the commas that separate selectors in a list, leaving the ones
// nested in `:is(a, b)`, `[data-x="a,b"]` and quoted strings alone.
export const splitSelectorList = (selectorText: string): string[] => {
  const selectors: string[] = [];
  let nestingDepth = 0;
  let openQuote: string | null = null;
  let selectorStart = 0;

  for (let index = 0; index < selectorText.length; index++) {
    const character = selectorText[index];
    if (character === "\\") {
      index++;
      continue;
    }
    if (openQuote) {
      if (character === openQuote) openQuote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      openQuote = character;
    } else if (character === "(" || character === "[") {
      nestingDepth++;
    } else if (character === ")" || character === "]") {
      nestingDepth = Math.max(0, nestingDepth - 1);
    } else if (character === "," && nestingDepth === 0) {
      selectors.push(selectorText.slice(selectorStart, index).trim());
      selectorStart = index + 1;
    }
  }

  selectors.push(selectorText.slice(selectorStart).trim());
  return selectors.filter(Boolean);
};
