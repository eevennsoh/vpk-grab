import { describe, expect, it, vi } from "vite-plus/test";
import type { ContextMenuActionContext } from "../src/types.js";
import { executeActionOrCopy } from "../src/utils/execute-action-or-copy.js";

const createContext = (): ContextMenuActionContext => ({
  element: Object.create(null),
  elements: [],
  copy: vi.fn(),
  hooks: {
    transformHtmlContent: async (html) => html,
    onOpenFile: () => false,
    transformOpenFileUrl: (url) => url,
  },
  performWithFeedback: async () => {},
  hideContextMenu: () => {},
  cleanup: () => {},
});

describe("executeActionOrCopy", () => {
  it("copies when the selected action is no longer registered", () => {
    const context = createContext();
    executeActionOrCopy(undefined, context);
    expect(context.copy).toHaveBeenCalledOnce();
  });

  it("copies when the selected action declines to run", () => {
    const context = createContext();
    const onAction = vi.fn();
    executeActionOrCopy({ id: "disabled", label: "Disabled", enabled: false, onAction }, context);
    expect(context.copy).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("executes a registered action without an extra copy", () => {
    const context = createContext();
    const onAction = vi.fn();
    executeActionOrCopy({ id: "custom", label: "Custom", onAction }, context);
    expect(onAction).toHaveBeenCalledWith(context);
    expect(context.copy).not.toHaveBeenCalled();
  });
});
