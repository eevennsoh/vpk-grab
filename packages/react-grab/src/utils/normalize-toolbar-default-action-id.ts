import {
  COMMENT_ACTION_ID,
  DEFAULT_ACTION_ID,
  LEGACY_STYLE_ACTION_ID,
  OPEN_ACTION_ID,
} from "../constants.js";

export const normalizeToolbarDefaultActionId = (actionId: string): string =>
  actionId === LEGACY_STYLE_ACTION_ID ||
  actionId === COMMENT_ACTION_ID ||
  actionId === OPEN_ACTION_ID
    ? DEFAULT_ACTION_ID
    : actionId;
