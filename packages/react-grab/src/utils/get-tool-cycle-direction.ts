import { TOOL_CYCLE_BACKWARD_KEY, TOOL_CYCLE_FORWARD_KEY } from "../constants.js";
import type { ToolCycleDirection } from "../types.js";
import { isMac } from "./is-mac.js";

export const getToolCycleDirection = (
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): ToolCycleDirection | null => {
  if (event.key !== TOOL_CYCLE_FORWARD_KEY && event.key !== TOOL_CYCLE_BACKWARD_KEY) return null;
  if (event.shiftKey || event.altKey) return null;
  const hasOnlyPlatformModifier = isMac()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (!hasOnlyPlatformModifier) return null;
  return event.key === TOOL_CYCLE_FORWARD_KEY ? "forward" : "backward";
};
