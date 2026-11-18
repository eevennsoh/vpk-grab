import { SELECTION_TOOL_CYCLE } from "../constants.js";
import type { AnnotationTool, SelectionTool, ToolCycleDirection } from "../types.js";

// The tool one step away in the Grab, Pen, Rectangle, Text ring. Move is not in the ring
// but sits just after Text, so stepping on starts it again at Grab and stepping
// back lands on Text.
export const getCycledSelectionTool = (
  currentTool: AnnotationTool,
  direction: ToolCycleDirection,
): SelectionTool => {
  const toolCount = SELECTION_TOOL_CYCLE.length;
  const currentIndex = SELECTION_TOOL_CYCLE.findIndex((tool) => tool === currentTool);
  if (currentIndex === -1) {
    return direction === "forward" ? SELECTION_TOOL_CYCLE[0] : SELECTION_TOOL_CYCLE[toolCount - 1];
  }
  const step = direction === "forward" ? 1 : -1;
  return SELECTION_TOOL_CYCLE[(currentIndex + step + toolCount) % toolCount];
};
