import { test, expect } from "./fixtures.js";

declare global {
  interface Window {
    __plainActionCalled?: boolean;
    __keyboardActionCalled?: boolean;
    __disabledShortcutCalled?: boolean;
    __enabledTagName?: string;
  }
}

test.describe("Plugin actions", () => {
  test("custom action should trigger enterPromptMode", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;

      api?.unregisterPlugin("custom-prompt-action");
      api?.registerPlugin({
        name: "custom-prompt-action",
        actions: [
          {
            id: "custom-prompt",
            label: "Custom Prompt",
            shortcut: "E",
            shortcutModifier: false,
            onAction: (context) => {
              context.enterPromptMode?.();
            },
          },
        ],
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");
    await reactGrab.page.waitForTimeout(100);

    await reactGrab.pressKey("e");
    await reactGrab.page.waitForTimeout(200);

    const isPromptMode = await reactGrab.isPromptModeActive();
    expect(isPromptMode).toBe(true);
  });
  test("action should just execute onAction", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;

      api?.unregisterPlugin("plain-action");
      api?.registerPlugin({
        name: "plain-action",
        actions: [
          {
            id: "plain-action",
            label: "Plain Action",
            shortcut: "K",
            shortcutModifier: false,
            onAction: () => {
              window.__plainActionCalled = true;
            },
          },
        ],
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.pressKey("k");
    await reactGrab.page.waitForTimeout(100);

    const actionCalled = await reactGrab.page.evaluate(() => window.__plainActionCalled ?? false);
    expect(actionCalled).toBe(true);
  });
  test("action with shortcut should be triggerable via keyboard", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;

      api?.unregisterPlugin("keyboard-action");
      api?.registerPlugin({
        name: "keyboard-action",
        actions: [
          {
            id: "keyboard-action",
            label: "Keyboard Action",
            shortcut: "K",
            shortcutModifier: false,
            onAction: () => {
              window.__keyboardActionCalled = true;
            },
          },
        ],
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");
    await reactGrab.page.waitForTimeout(100);

    await reactGrab.pressKey("k");
    await reactGrab.page.waitForTimeout(200);

    const actionCalled = await reactGrab.page.evaluate(
      () => window.__keyboardActionCalled ?? false,
    );
    expect(actionCalled).toBe(true);
  });
  test("disabled action should not run through its keyboard shortcut", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;

      api?.unregisterPlugin("disabled-shortcut-action");
      api?.registerPlugin({
        name: "disabled-shortcut-action",
        actions: [
          {
            id: "disabled-shortcut-action",
            label: "Disabled Shortcut Action",
            enabled: false,
            shortcut: "K",
            shortcutModifier: false,
            onAction: () => {
              window.__disabledShortcutCalled = true;
            },
          },
        ],
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");
    await reactGrab.pressKey("k");

    const actionCalled = await reactGrab.page.evaluate(
      () => window.__disabledShortcutCalled ?? false,
    );
    expect(actionCalled).toBe(false);
  });
  test("action enabled function should receive context", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;

      api?.unregisterPlugin("context-action");
      api?.registerPlugin({
        name: "context-action",
        actions: [
          {
            id: "context-action",
            label: "Context Action",
            shortcut: "K",
            shortcutModifier: false,
            enabled: (context) => {
              window.__enabledTagName = context.element.tagName;
              return context.element.tagName.toLowerCase() === "button";
            },
            onAction: () => {},
          },
        ],
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='plain-button']");

    await reactGrab.pressKey("k");
    const enabledTagName = await reactGrab.page.evaluate(() => window.__enabledTagName);
    expect(enabledTagName).toBe("BUTTON");
  });
});
