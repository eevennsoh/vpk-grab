import { describe, expect, it } from "vite-plus/test";
import { normalizeToolbarDefaultActionId } from "../src/utils/normalize-toolbar-default-action-id.js";
import { commentPlugin } from "../src/core/plugins/comment.js";
import { openPlugin } from "../src/core/plugins/open.js";

describe("toolbar default actions", () => {
  it.each(["edit", "comment", "open"])("replaces the removed %s default with Copy", (actionId) => {
    expect(normalizeToolbarDefaultActionId(actionId)).toBe("copy");
  });

  it.each(["copy", "custom-action"])("preserves the %s default", (actionId) => {
    expect(normalizeToolbarDefaultActionId(actionId)).toBe(actionId);
  });

  it("keeps Comment registered without a shortcut or toolbar entry", () => {
    expect(commentPlugin.actions?.[0]).toMatchObject({ id: "comment", label: "Comment" });
    expect(commentPlugin.actions?.[0].shortcut).toBeUndefined();
    expect(commentPlugin.actions?.[0].showInToolbarMenu).not.toBe(true);
    expect(openPlugin.actions?.[0].showInToolbarMenu).not.toBe(true);
  });
});
