import { DEFAULT_ACTION_ID, LEGACY_STYLE_ACTION_ID } from "../constants.js";

export const normalizeToolbarDefaultActionId = (actionId: string): string =>
  actionId === LEGACY_STYLE_ACTION_ID || actionId === "comment" || actionId === "open"
    ? DEFAULT_ACTION_ID
    : actionId;
