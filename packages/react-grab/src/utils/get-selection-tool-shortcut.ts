import {
  PEN_TOOL_KEY,
  RECTANGLE_TOOL_KEY,
  TEXT_TOOL_KEY,
  TOOL_CYCLE_HORIZONTAL_ARROW_LABELS,
  TOOL_CYCLE_MODIFIER_LABEL,
  TOOL_CYCLE_MODIFIER_LABEL_MAC,
  TOOL_CYCLE_VERTICAL_ARROW_LABELS,
} from "../constants.js";
import type { AnnotationTool, SelectionTool, ToolCycleDirection } from "../types.js";
import { getCycledSelectionTool } from "./get-cycled-selection-tool.js";
import { isMac } from "./is-mac.js";

const getToolCycleLabel = (direction: ToolCycleDirection, isToolbarVertical: boolean): string => {
  const modifierLabel = isMac() ? TOOL_CYCLE_MODIFIER_LABEL_MAC : TOOL_CYCLE_MODIFIER_LABEL;
  const arrowLabels = isToolbarVertical
    ? TOOL_CYCLE_VERTICAL_ARROW_LABELS
    : TOOL_CYCLE_HORIZONTAL_ARROW_LABELS;
  return `${modifierLabel}${arrowLabels[direction]}`;
};

// From Grab, the platform modifier and an arrow reach the adjacent tools in
// the ring; the label shows the arrows along the toolbar, though both axes work.
// Drawing tools and Move show the drawing numbers, including the tool in hand.
// Before activation only Grab has a key, the one that activates.
export const getSelectionToolShortcut = (
  tool: SelectionTool,
  currentTool: AnnotationTool,
  isActive: boolean,
  activationShortcut: string | undefined,
  isToolbarVertical: boolean,
): string | undefined => {
  if (!isActive) return tool === "grab" ? activationShortcut : undefined;
  if (currentTool !== "grab") {
    if (tool === "pen") return PEN_TOOL_KEY;
    if (tool === "rectangle") return RECTANGLE_TOOL_KEY;
    if (tool === "text") return TEXT_TOOL_KEY;
  }
  if (tool === currentTool) return undefined;
  if (tool === getCycledSelectionTool(currentTool, "forward")) {
    return getToolCycleLabel("forward", isToolbarVertical);
  }
  if (tool === getCycledSelectionTool(currentTool, "backward")) {
    return getToolCycleLabel("backward", isToolbarVertical);
  }
  return undefined;
};
