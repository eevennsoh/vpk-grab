import { TOOL_CYCLE_BACKWARD_KEY, TOOL_CYCLE_FORWARD_KEY } from "../constants.js";
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
  if (event.key !== TOOL_CYCLE_FORWARD_KEY && event.key !== TOOL_CYCLE_BACKWARD_KEY) return null;
  if (event.shiftKey || event.altKey) return null;
  const hasOnlyPlatformModifier = isMac()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (!hasOnlyPlatformModifier) return null;
  return event.key === TOOL_CYCLE_FORWARD_KEY ? "forward" : "backward";
};
