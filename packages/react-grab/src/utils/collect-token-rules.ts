import { parseCssDeclarations, type CssDeclaration } from "./parse-css-declarations.js";
import { walkStyleRules } from "./walk-style-rules.js";

export interface TokenRule {
  selector: string;
  // The same selector with `:hover` satisfied, for an element whose hover
  // styles are pinned inline while the real hover is gone.
  hoverlessSelector: string | null;
  declarations: CssDeclaration[];
}

const VARIABLE_FUNCTION = "var(";
// Not preceded by a backslash: `.md\:hover\:flex` is a class name.
const HOVER_PSEUDO_CLASS_PATTERN = /(?<!\\):hover(?![\w-])/g;
const ALWAYS_MATCHING_PSEUDO_CLASS = ":is(*)";

// Every style rule with a declaration written in terms of a custom property,
// which is where a design token leaves its name.
export const collectTokenRules = (rules: Iterable<CSSRule>): TokenRule[] => {
  const tokenRules: TokenRule[] = [];

  walkStyleRules(rules, (selector, styleDeclarations) => {
    const cssText = styleDeclarations.cssText;
    if (!cssText || !cssText.includes(VARIABLE_FUNCTION)) return;
    const declarations = parseCssDeclarations(cssText).filter((declaration) =>
      declaration.value.includes(VARIABLE_FUNCTION),
    );
    if (declarations.length === 0) return;

    const hoverlessSelector = selector.replace(
      HOVER_PSEUDO_CLASS_PATTERN,
      ALWAYS_MATCHING_PSEUDO_CLASS,
    );
    tokenRules.push({
      selector,
      hoverlessSelector: hoverlessSelector === selector ? null : hoverlessSelector,
      declarations,
    });
  });

  return tokenRules;
};
