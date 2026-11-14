import { isHtmlElement } from "./is-html-element.js";
import { isReactGrabElement } from "./is-react-grab-element.js";
import { collectHoverRules } from "./collect-hover-rules.js";
import { createSheetRuleCache } from "./create-sheet-rule-cache.js";

const HOVER_PSEUDO_CLASS = ":hover";

const getHoverRules = createSheetRuleCache(collectHoverRules);

// The cursor's own ancestor chain is not the only thing a hover styles: a rule
// such as `.card:hover .more` or Tailwind's `group-hover:` reveals elements
// elsewhere inside the hovered container. Those lose the style the moment the
// freeze takes the hover away, so each element a `:hover` rule currently
// matches is recorded with the properties that rule sets, ready to be pinned.
export const collectHoverDependentProperties = (
  targetDocument: Document,
  propertyNamesByElement: Map<HTMLElement, Set<string>>,
): void => {
  if (!targetDocument.querySelector(HOVER_PSEUDO_CLASS)) return;

  const sheets = [...targetDocument.styleSheets, ...(targetDocument.adoptedStyleSheets ?? [])];
  for (const sheet of sheets) {
    if (sheet.disabled) continue;
    for (const hoverRule of getHoverRules(sheet) ?? []) {
      let matchedElements: NodeListOf<Element>;
      try {
        matchedElements = targetDocument.querySelectorAll(hoverRule.selector);
      } catch {
        // A selector this engine cannot parse matches nothing here either.
        continue;
      }
      for (const matchedElement of matchedElements) {
        if (!isHtmlElement(matchedElement) || isReactGrabElement(matchedElement)) continue;
        let propertyNames = propertyNamesByElement.get(matchedElement);
        if (!propertyNames) {
          propertyNames = new Set<string>();
          propertyNamesByElement.set(matchedElement, propertyNames);
        }
        for (const propertyName of hoverRule.propertyNames) propertyNames.add(propertyName);
      }
    }
  }
};
