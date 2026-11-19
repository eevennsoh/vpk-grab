import { getTagName } from "./get-tag-name.js";
import { isHtmlElement } from "./is-html-element.js";

const EDITABLE_TAGS_AND_ROLES: readonly string[] = [
  "input",
  "textarea",
  "select",
  "searchbox",
  "slider",
  "spinbutton",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "textbox",
  "combobox",
];

const getTargetElement = (event: Event): HTMLElement | undefined => {
  const target = event.composed ? event.composedPath()[0] : event.target;
  return isHtmlElement(target) ? target : undefined;
};

export const isKeyboardEventTriggeredByInput = (event: Event): boolean => {
  if (document.designMode === "on") return true;

  const targetElement = getTargetElement(event);
  if (!targetElement) return false;

  if (targetElement.isContentEditable || targetElement.ownerDocument.designMode === "on")
    return true;

  const tagName = getTagName(targetElement);
  return EDITABLE_TAGS_AND_ROLES.some(
    (tagOrRole) => tagOrRole === tagName || tagOrRole === targetElement.role,
  );
};

export const hasTextSelectionInInput = (event: KeyboardEvent): boolean => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? 0;
    return selectionEnd - selectionStart > 0;
  }
  return false;
};

export const hasTextSelectionOnPage = (): boolean => {
  const selection = window.getSelection();
  if (!selection) return false;
  return selection.toString().length > 0;
};
