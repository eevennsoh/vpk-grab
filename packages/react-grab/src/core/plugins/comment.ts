import type { Plugin } from "../../types.js";
import { COMMENT_ACTION_ID } from "../../constants.js";

export const commentPlugin: Plugin = {
  name: "comment",
  actions: [
    {
      id: COMMENT_ACTION_ID,
      label: "Comment",
      onAction: (context) => {
        context.enterPromptMode?.();
      },
    },
  ],
};
