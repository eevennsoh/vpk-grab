import type { Plugin } from "../../types.js";

export const commentPlugin: Plugin = {
  name: "comment",
  actions: [
    {
      id: "comment",
      label: "Comment",
      onAction: (context) => {
        context.enterPromptMode?.();
      },
    },
  ],
};
