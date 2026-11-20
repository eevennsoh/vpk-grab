import { PROMPT_EDGE_FADE_PX } from "../constants.js";

export const getPromptEdgeFadeMask = (hasHiddenStart: boolean, hasHiddenEnd: boolean): string => {
  if (!hasHiddenStart && !hasHiddenEnd) return "none";
  const start = hasHiddenStart ? `transparent 0, #000 ${PROMPT_EDGE_FADE_PX}px` : "#000 0";
  const end = hasHiddenEnd
    ? `#000 calc(100% - ${PROMPT_EDGE_FADE_PX}px), transparent 100%`
    : "#000 100%";
  return `linear-gradient(to right, ${start}, ${end})`;
};
