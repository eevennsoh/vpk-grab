export interface CssDeclaration {
  property: string;
  value: string;
}

const IMPORTANT_SUFFIX_PATTERN = /\s*!\s*important\s*$/i;

const splitDeclarations = (cssText: string): string[] => {
  const declarations: string[] = [];
  let parenthesisDepth = 0;
  let openQuote: string | null = null;
  let declarationStart = 0;

  for (let index = 0; index < cssText.length; index++) {
    const character = cssText[index];
    if (openQuote !== null) {
      if (character === "\\") index++;
      else if (character === openQuote) openQuote = null;
      continue;
    }
    if (character === '"' || character === "'") openQuote = character;
    else if (character === "(") parenthesisDepth++;
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (character === ";" && parenthesisDepth === 0) {
      declarations.push(cssText.slice(declarationStart, index));
      declarationStart = index + 1;
    }
  }
  declarations.push(cssText.slice(declarationStart));
  return declarations;
};

// A CSSStyleDeclaration lists longhands, and a shorthand written with var()
// leaves every one of them empty until the variable is substituted. Its
// cssText still holds the declarations as authored, so those are read from it.
export const parseCssDeclarations = (cssText: string): CssDeclaration[] => {
  const declarations: CssDeclaration[] = [];
  for (const declarationText of splitDeclarations(cssText)) {
    const separatorIndex = declarationText.indexOf(":");
    if (separatorIndex === -1) continue;
    const property = declarationText.slice(0, separatorIndex).trim();
    const value = declarationText
      .slice(separatorIndex + 1)
      .replace(IMPORTANT_SUFFIX_PATTERN, "")
      .trim();
    if (property && value) declarations.push({ property, value });
  }
  return declarations;
};
