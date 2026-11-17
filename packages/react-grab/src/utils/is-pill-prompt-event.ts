import { PILL_PROMPT_ATTRIBUTE } from "../constants.js";
import { isEventFromOverlay } from "./is-event-from-overlay.js";

export const isPillPromptEvent = (event: Event): boolean =>
  isEventFromOverlay(event, PILL_PROMPT_ATTRIBUTE);
