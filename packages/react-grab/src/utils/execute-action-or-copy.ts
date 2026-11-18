import type { ContextMenuAction, ContextMenuActionContext } from "../types.js";
import { executeContextMenuAction } from "./execute-context-menu-action.js";

export const executeActionOrCopy = (
  action: ContextMenuAction | undefined,
  context: ContextMenuActionContext,
): void => {
  if (!action || !executeContextMenuAction(action, context)) {
    context.copy?.();
  }
};
