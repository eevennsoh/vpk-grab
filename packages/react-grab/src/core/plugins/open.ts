import type { Plugin } from "../../types.js";
import { OPEN_ACTION_ID } from "../../constants.js";
import { executeOpenFileAction } from "../open-file-action.js";

export const openPlugin: Plugin = {
  name: "open",
  actions: [
    {
      id: OPEN_ACTION_ID,
      label: "Open",
      shortcut: "O",
      enabled: (context) => Boolean(context.filePath),
      onAction: (context) => {
        if (!context.filePath) return;

        executeOpenFileAction(context.filePath, context.lineNumber, context.hooks);

        context.cleanup();
      },
    },
  ],
};
