import {
  PEN_TOOL_KEY,
  RECTANGLE_TOOL_KEY,
  TEXT_TOOL_KEY,
  TOOL_CYCLE_BACKWARD_LABEL,
  TOOL_CYCLE_BACKWARD_LABEL_MAC,
  TOOL_CYCLE_FORWARD_LABEL,
  TOOL_CYCLE_FORWARD_LABEL_MAC,
} from "../constants.js";
import type { AnnotationTool, SelectionTool } from "../types.js";
import { getCycledSelectionTool } from "./get-cycled-selection-tool.js";
import { isMac } from "./is-mac.js";

// From Grab, the platform modifier and horizontal arrows reach the adjacent
// tools in the ring. Drawing tools and Move show the drawing
// numbers, including the tool in hand. Before activation only Grab has a key,
// the one that activates.
export const getSelectionToolShortcut = (
  tool: SelectionTool,
  currentTool: AnnotationTool,
  isActive: boolean,
  activationShortcut: string | undefined,
): string | undefined => {
  if (!isActive) return tool === "grab" ? activationShortcut : undefined;
  if (currentTool !== "grab") {
    if (tool === "pen") return PEN_TOOL_KEY;
    if (tool === "rectangle") return RECTANGLE_TOOL_KEY;
    if (tool === "text") return TEXT_TOOL_KEY;
  }
  if (tool === currentTool) return undefined;
  if (tool === getCycledSelectionTool(currentTool, "forward")) {
    return isMac() ? TOOL_CYCLE_FORWARD_LABEL_MAC : TOOL_CYCLE_FORWARD_LABEL;
  }
  if (tool === getCycledSelectionTool(currentTool, "backward")) {
    return isMac() ? TOOL_CYCLE_BACKWARD_LABEL_MAC : TOOL_CYCLE_BACKWARD_LABEL;
  }
  return undefined;
};
