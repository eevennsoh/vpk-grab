import {
  TOOL_CYCLE_BACKWARD_LABEL,
  TOOL_CYCLE_BACKWARD_LABEL_MAC,
  TOOL_CYCLE_FORWARD_LABEL,
  TOOL_CYCLE_FORWARD_LABEL_MAC,
} from "../constants.js";
import type { AnnotationTool, SelectionTool } from "../types.js";
import { getCycledSelectionTool } from "./get-cycled-selection-tool.js";
import { isMac } from "./is-mac.js";

// The key that reaches a tool from where the user is: the next tool in the
// ring is one modifier tap away and the previous one is a Shift tap away. The
// tool in hand needs none. Before activation only Grab has a key, the one that
// activates.
export const getSelectionToolShortcut = (
  tool: SelectionTool,
  currentTool: AnnotationTool,
  isActive: boolean,
  activationShortcut: string | undefined,
): string | undefined => {
  if (!isActive) return tool === "grab" ? activationShortcut : undefined;
  if (tool === currentTool) return undefined;
  if (tool === getCycledSelectionTool(currentTool, "forward")) {
    return isMac() ? TOOL_CYCLE_FORWARD_LABEL_MAC : TOOL_CYCLE_FORWARD_LABEL;
  }
  if (tool === getCycledSelectionTool(currentTool, "backward")) {
    return isMac() ? TOOL_CYCLE_BACKWARD_LABEL_MAC : TOOL_CYCLE_BACKWARD_LABEL;
  }
  return undefined;
};
