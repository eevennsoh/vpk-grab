import { isHtmlElement } from "./is-html-element.js";

const CARET_INPUT_TYPES: readonly string[] = ["text", "search", "url", "tel", "email", "password"];
const CARET_ROLES: readonly string[] = ["textbox", "searchbox", "combobox"];

// Only a field with text has a caret for a modifier+arrow to move. An empty
// one, or a control such as a menu item, gives the chord to the toolbar.
export const isPageFieldHoldingText = (event: KeyboardEvent): boolean => {
  const target = event.composed ? event.composedPath()[0] : event.target;
  if (target instanceof HTMLTextAreaElement) return target.value.length > 0;
  if (target instanceof HTMLInputElement) {
    return CARET_INPUT_TYPES.includes(target.type) && target.value.length > 0;
  }
  if (!isHtmlElement(target)) return false;
  if (!target.isContentEditable && !CARET_ROLES.includes(target.role ?? "")) return false;
  return (target.textContent ?? "").length > 0;
};
