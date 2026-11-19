import { TOOL_CYCLE_DIRECTION_BY_KEY } from "../constants.js";
import type { ToolCycleDirection } from "../types.js";
import { isMac } from "./is-mac.js";

interface ToolCycleKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export const getToolCycleDirection = (event: ToolCycleKeyEvent): ToolCycleDirection | null => {
  const direction = TOOL_CYCLE_DIRECTION_BY_KEY.get(event.key);
  if (!direction) return null;
  if (event.shiftKey || event.altKey) return null;
  const hasOnlyPlatformModifier = isMac()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (!hasOnlyPlatformModifier) return null;
  return direction;
};
